const { nowIso } = require("../utils/time");
const {
  classifyLoginState,
  classifyTurnstileState,
  createRawTextSample,
  extractCandidateLines,
  extractPercentTokens
} = require("../parsers/common");

const NAVIGATION_TIMEOUT_MS = 45000;
const DOM_EXTRACTION_TIMEOUT_MS = 8000;
const USAGE_READY_TIMEOUT_MS = 15000;

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = url.hash || "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(value || "").replace(/\/$/, "").toLowerCase();
  }
}

function configuredUsageUrlMatches(pageUrl, usageUrl) {
  if (!pageUrl || !usageUrl) {
    return false;
  }

  const normalizedPageUrl = normalizeUrl(pageUrl);
  const normalizedUsageUrl = normalizeUrl(usageUrl);

  return normalizedPageUrl === normalizedUsageUrl;
}

function serviceUsagePageMatches(service, pageUrl) {
  if (!pageUrl) {
    return false;
  }

  if (configuredUsageUrlMatches(pageUrl, service.usageUrl)) {
    return true;
  }

  let url;

  try {
    url = new URL(pageUrl);
  } catch {
    return false;
  }

  const host = url.hostname.toLowerCase();
  const location = `${url.pathname}${url.search}${url.hash}`.toLowerCase();

  if (service.key === "codex") {
    return host.includes("chatgpt.com") && (
      location.includes("analytics") ||
      location.includes("usage") ||
      (location.includes("codex") && location.includes("settings"))
    );
  }

  if (service.key === "claude") {
    return host.includes("claude.ai") && location.includes("settings") && location.includes("usage");
  }

  return false;
}

function createMissingUsagePageExtraction(service, extractedAt) {
  return {
    serviceKey: service.key,
    serviceName: service.name,
    url: service.usageUrl,
    finalUrl: null,
    bodyText: "",
    percentTokens: [],
    candidateLines: [],
    domCandidates: [],
    accessibilityCandidates: [],
    extractedAt,
    navigationStatus: null,
    error: {
      reason: "usage_page_not_open",
      message: `${service.name} usage page is not open in the current browser context.`,
      rawTextSample: ""
    },
    loginState: {
      loginLikely: false,
      urlLooksLogin: false,
      textLooksLogin: false,
      textLooksUsage: false
    },
    turnstileState: {
      turnstileLikely: false
    }
  };
}

async function findExistingUsagePage(context, service) {
  const candidates = await listUsagePageCandidates(context, service);
  const selected = selectUsagePageCandidate(candidates);

  return selected ? selected.page : null;
}

function sourceMetadataFromCandidate(candidate, reason) {
  if (!candidate) {
    return {
      selected: false,
      reason,
      tabCount: 0,
      candidateCount: 0,
      selectedTab: null,
      candidates: []
    };
  }

  return {
    selected: true,
    reason,
    tabCount: candidate.tabCount,
    candidateCount: candidate.candidateCount,
    selectedTab: sanitizeCandidate(candidate),
    candidates: candidate.candidates.map(sanitizeCandidate)
  };
}

function sanitizeCandidate(candidate) {
  return {
    index: candidate.index,
    targetId: candidate.targetId || null,
    url: candidate.url || "",
    title: candidate.title || "",
    matchType: candidate.matchType || "unknown",
    score: candidate.score || 0
  };
}

async function getPageTargetInfo(page) {
  try {
    const session = await page.context().newCDPSession(page);
    const result = await session.send("Target.getTargetInfo");
    await session.detach().catch(() => {});
    return result && result.targetInfo ? result.targetInfo : null;
  } catch {
    return null;
  }
}

async function pageTitle(page) {
  try {
    return await page.title();
  } catch {
    return "";
  }
}

async function listUsagePageCandidates(context, service) {
  const pages = context.pages();
  const candidates = [];

  for (const [index, page] of pages.entries()) {
    let pageUrl = "";

    try {
      pageUrl = page.url();
    } catch {
      pageUrl = "";
    }

    if (!serviceUsagePageMatches(service, pageUrl)) {
      continue;
    }

    const targetInfo = await getPageTargetInfo(page);
    const exact = configuredUsageUrlMatches(pageUrl, service.usageUrl);
    const title = targetInfo && targetInfo.title ? targetInfo.title : await pageTitle(page);
    const titleMatch = String(title || "").toLowerCase().includes(service.name.toLowerCase());

    candidates.push({
      page,
      index,
      targetId: targetInfo && targetInfo.targetId ? targetInfo.targetId : null,
      url: pageUrl,
      title,
      matchType: exact ? "exact_configured_url" : "provider_url_pattern",
      score: (exact ? 100 : 50) + (titleMatch ? 10 : 0) + index / 1000
    });
  }

  return candidates.map((candidate) => ({
    ...candidate,
    tabCount: pages.length,
    candidateCount: candidates.length,
    candidates
  }));
}

function selectUsagePageCandidate(candidates) {
  return [...(candidates || [])]
    .sort((a, b) => b.score - a.score || b.index - a.index)[0] || null;
}

async function selectExistingUsagePage(context, service) {
  const candidates = await listUsagePageCandidates(context, service);
  const selected = selectUsagePageCandidate(candidates);

  return {
    page: selected ? selected.page : null,
    source: selected ? sourceMetadataFromCandidate(selected, "selected_existing_usage_tab") : {
      selected: false,
      reason: "usage_page_not_open",
      tabCount: context.pages().length,
      candidateCount: 0,
      selectedTab: null,
      candidates: []
    }
  };
}

async function safeEvaluate(page, callback, fallback) {
  try {
    return await page.evaluate(callback);
  } catch (error) {
    return fallback;
  }
}

async function extractBodyText(page) {
  try {
    return await page.locator("body").innerText({ timeout: DOM_EXTRACTION_TIMEOUT_MS });
  } catch (error) {
    return "";
  }
}

function usageTextReady(service, text) {
  const value = String(text || "");

  if (!/%/.test(value)) {
    return false;
  }

  if (service.key === "codex") {
    return /5\s*시간|5\s*hour|5-hour|5h/i.test(value) && /주간|weekly|week/i.test(value);
  }

  if (service.key === "claude") {
    return /현재\s*세션|current\s*session|세션/i.test(value) && /모든\s*모델|all\s*models|model/i.test(value);
  }

  return true;
}

async function waitForUsageText(page, service) {
  const deadline = Date.now() + USAGE_READY_TIMEOUT_MS;
  let latestText = "";

  while (Date.now() < deadline) {
    latestText = await extractBodyText(page);

    if (usageTextReady(service, latestText)) {
      return latestText;
    }

    await page.waitForTimeout(500).catch(() => {});
  }

  return latestText;
}

async function extractDomCandidates(page) {
  return safeEvaluate(
    page,
    () => {
      const candidates = [];

      function pushCandidate(type, value, extra = {}) {
        const text = String(value || "").replace(/\s+/g, " ").trim();

        if (!text) {
          return;
        }

        candidates.push({
          type,
          text: text.slice(0, 500),
          ...extra
        });
      }

      document.querySelectorAll("[aria-label]").forEach((element) => {
        pushCandidate("aria-label", element.getAttribute("aria-label"), {
          tagName: element.tagName.toLowerCase(),
          role: element.getAttribute("role") || null
        });
      });

      document.querySelectorAll('[role="progressbar"]').forEach((element) => {
        const ariaValueNow = element.getAttribute("aria-valuenow");
        const ariaValueText = element.getAttribute("aria-valuetext");
        const ariaValueMin = element.getAttribute("aria-valuemin");
        const ariaValueMax = element.getAttribute("aria-valuemax");
        const now = Number(ariaValueNow);
        const max = Number(ariaValueMax);
        const computedPercent = Number.isFinite(now) && Number.isFinite(max) && max > 0 ? `${Math.round((now / max) * 100)}%` : "";

        pushCandidate("progressbar", [element.textContent, ariaValueText, computedPercent, ariaValueNow].filter(Boolean).join(" "), {
          tagName: element.tagName.toLowerCase(),
          ariaValueNow,
          ariaValueText,
          ariaValueMin,
          ariaValueMax
        });
      });

      document.querySelectorAll("progress").forEach((element) => {
        const value = element.getAttribute("value");
        const max = element.getAttribute("max");
        const numericValue = Number(value);
        const numericMax = Number(max);
        const computedPercent = Number.isFinite(numericValue) && Number.isFinite(numericMax) && numericMax > 0 ? `${Math.round((numericValue / numericMax) * 100)}%` : "";

        pushCandidate("progress", [element.textContent, computedPercent, value].filter(Boolean).join(" "), {
          tagName: element.tagName.toLowerCase(),
          value,
          max
        });
      });

      document.querySelectorAll("main, section, article, aside, div, li, p, span, button").forEach((element) => {
        const text = String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();

        if (!text || text.length < 2 || text.length > 500) {
          return;
        }

        if (/%|\busage\b|\blimit\b|\breset\b|\bweek\b|\bhour\b|\bremaining\b|\b남음\b|\b사용\b|\b한도\b/i.test(text)) {
          pushCandidate("visible-text", text, {
            tagName: element.tagName.toLowerCase(),
            role: element.getAttribute("role") || null
          });
        }
      });

      return candidates.slice(0, 120);
    },
    []
  );
}

async function extractAccessibilityCandidates(page) {
  try {
    const snapshot = await page.accessibility.snapshot({ interestingOnly: true });
    const candidates = [];

    function walk(node) {
      if (!node) {
        return;
      }

      const text = [node.name, node.value, node.description].filter(Boolean).join(" ").trim();

      if (text && /%|\busage\b|\blimit\b|\breset\b|\bweek\b|\bhour\b|\bremaining\b|\b남음\b|\b사용\b|\b한도\b/i.test(text)) {
        candidates.push({
          type: "accessibility",
          role: node.role || null,
          text: text.replace(/\s+/g, " ").slice(0, 500)
        });
      }

      if (Array.isArray(node.children)) {
        node.children.forEach(walk);
      }
    }

    walk(snapshot);
    return candidates.slice(0, 80);
  } catch (error) {
    return [];
  }
}

async function extractUsagePage(context, service, options = {}) {
  const extractedAt = nowIso();
  const settings = {
    reuseExistingPages: options.reuseExistingPages !== false,
    openMissingPages: options.openMissingPages !== false,
    allowFocusSteal: options.allowFocusSteal === true,
    reloadExistingPages: options.reloadExistingPages !== false,
    postReloadWaitMs: Number(options.postReloadWaitMs || 0)
  };
  let page = null;
  let shouldClosePage = false;
  let source = null;
  let reusedExistingPage = false;
  let reloadedExistingPage = false;

  if (settings.reuseExistingPages) {
    const selected = await selectExistingUsagePage(context, service);
    page = selected.page;
    source = selected.source;
    reusedExistingPage = Boolean(page);
  }

  if (!page && !settings.openMissingPages) {
    const missing = createMissingUsagePageExtraction(service, extractedAt);
    missing.source = source || {
      selected: false,
      reason: "usage_page_not_open",
      tabCount: context.pages().length,
      candidateCount: 0,
      selectedTab: null,
      candidates: []
    };
    return missing;
  }

  if (!page) {
    page = await context.newPage();
    shouldClosePage = true;
    source = {
      selected: true,
      reason: "opened_new_controlled_tab",
      tabCount: context.pages().length,
      candidateCount: 0,
      selectedTab: null,
      candidates: []
    };
  }

  try {
    page.setDefaultTimeout(DOM_EXTRACTION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);

    let response = null;
    const currentUrl = page.url();

    if (!serviceUsagePageMatches(service, currentUrl)) {
      response = await page.goto(service.usageUrl, {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT_MS
      });
      source.reason = "navigated_selected_tab";
    } else if (reusedExistingPage && settings.reloadExistingPages) {
      response = await page.reload({
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT_MS
      });
      reloadedExistingPage = true;

      if (settings.postReloadWaitMs > 0) {
        await page.waitForTimeout(settings.postReloadWaitMs).catch(() => {});
      }
    }

    try {
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch (error) {
    }

    const finalUrl = page.url();
    const targetInfo = await getPageTargetInfo(page);
    const title = targetInfo && targetInfo.title ? targetInfo.title : await pageTitle(page);
    const selectedTab = source && source.selectedTab ? source.selectedTab : {};
    source = {
      ...(source || {}),
      selected: true,
      selectedTab: {
        ...selectedTab,
        targetId: (targetInfo && targetInfo.targetId) || selectedTab.targetId || null,
        url: finalUrl,
        title,
        matchType: serviceUsagePageMatches(service, finalUrl) ? (configuredUsageUrlMatches(finalUrl, service.usageUrl) ? "exact_configured_url" : "provider_url_pattern") : "navigated",
        score: selectedTab.score || null
      },
      reusedExistingPage,
      reloadedExistingPage,
      openedNewPage: shouldClosePage,
      activelyNavigated: Boolean(response && !reloadedExistingPage)
    };
    const bodyText = await waitForUsageText(page, service);
    const domCandidates = await extractDomCandidates(page);
    const accessibilityCandidates = await extractAccessibilityCandidates(page);
    const combinedText = [
      bodyText,
      ...domCandidates.map((candidate) => candidate.text),
      ...accessibilityCandidates.map((candidate) => candidate.text)
    ].join("\n");

    return {
      serviceKey: service.key,
      serviceName: service.name,
      url: service.usageUrl,
      finalUrl,
      bodyText,
      percentTokens: extractPercentTokens(combinedText),
      candidateLines: extractCandidateLines(combinedText),
      domCandidates,
      accessibilityCandidates,
      extractedAt,
      navigationStatus: response ? response.status() : null,
      source,
      error: null,
      loginState: classifyLoginState(finalUrl, bodyText),
      turnstileState: classifyTurnstileState(finalUrl, combinedText)
    };
  } catch (error) {
    const finalUrl = page.url();
    const bodyText = await extractBodyText(page);
    const errorReason = error.name === "TimeoutError" ? "page_timeout" : "page_navigation_failure";

    return {
      serviceKey: service.key,
      serviceName: service.name,
      url: service.usageUrl,
      finalUrl,
      bodyText,
      percentTokens: extractPercentTokens(bodyText),
      candidateLines: extractCandidateLines(bodyText),
      domCandidates: [],
      accessibilityCandidates: [],
      extractedAt,
      navigationStatus: null,
      source,
      error: {
        reason: errorReason,
        message: error.message,
        rawTextSample: createRawTextSample(bodyText)
      },
      loginState: classifyLoginState(finalUrl, bodyText),
      turnstileState: classifyTurnstileState(finalUrl, bodyText)
    };
  } finally {
    if (shouldClosePage) {
      await page.close().catch(() => {});
    }
  }
}

module.exports = {
  extractUsagePage,
  listUsagePageCandidates,
  selectUsagePageCandidate,
  serviceUsagePageMatches
};
