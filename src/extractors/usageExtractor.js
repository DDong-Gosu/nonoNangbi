const { nowIso } = require("../utils/time");
const {
  classifyLoginState,
  createRawTextSample,
  extractCandidateLines,
  extractPercentTokens
} = require("../parsers/common");

const NAVIGATION_TIMEOUT_MS = 45000;
const DOM_EXTRACTION_TIMEOUT_MS = 8000;

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

async function extractUsagePage(context, service) {
  const extractedAt = nowIso();
  const page = await context.newPage();

  try {
    page.setDefaultTimeout(DOM_EXTRACTION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);

    const response = await page.goto(service.usageUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS
    });

    try {
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch (error) {
    }

    const finalUrl = page.url();
    const bodyText = await extractBodyText(page);
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
      error: null,
      loginState: classifyLoginState(finalUrl, bodyText)
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
      error: {
        reason: errorReason,
        message: error.message,
        rawTextSample: createRawTextSample(bodyText)
      },
      loginState: classifyLoginState(finalUrl, bodyText)
    };
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = {
  extractUsagePage
};
