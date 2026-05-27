const { nowIso } = require("../utils/time");

const PERCENT_REGEX = /(?:100|[1-9]?\d)(?:\.\d+)?\s*%/g;
const LOGIN_URL_REGEX = /login|signin|sign-in|auth|oauth|account\/login/i;
const LOGIN_TEXT_REGEX = /sign in|log in|login|continue with|authenticate|authentication|verify your email|로그인|인증|계정에 로그인/i;
const USAGE_TEXT_REGEX = /usage|limit|remaining|reset|week|weekly|hour|hours|5h|사용량|사용|한도|남음|재설정|주간|시간/i;
const TURNSTILE_TEXT_REGEX = /cloudflare|turnstile|verify you are human|checking if the site connection is secure|사람인지 확인하십시오|사람인지 확인하세요|보안 확인 수행 중/i;

const ANTI_KEYWORDS = [
  "할인",
  "쿠폰",
  "프로모션",
  "이벤트",
  "discount",
  "promo",
  "promotion",
  "coupon",
  " off",
  "% off",
  "sale",
  "광고",
  "ad ",
  "advert",
  "savings",
  "save up to"
];

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function percentTokenToNumber(token) {
  const match = String(token).match(/(?:100|[1-9]?\d)(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const value = Number(match[0]);

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }

  return value;
}

function remainingFromRaw(rawPercent, meaning) {
  if (rawPercent === null || rawPercent === undefined) {
    return null;
  }

  if (meaning === "remaining") {
    return rawPercent;
  }

  if (meaning === "used") {
    return 100 - rawPercent;
  }

  return null;
}

function extractPercentTokens(text) {
  const matches = String(text || "").match(PERCENT_REGEX) || [];
  return [...new Set(matches.map((match) => normalizeWhitespace(match)))].slice(0, 80);
}

function extractCandidateLines(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(normalizeWhitespace)
    .filter(Boolean);

  return lines
    .filter((line) => /%|usage|limit|remaining|reset|week|weekly|hour|hours|5h|사용량|사용|한도|남음|재설정|주간|시간/i.test(line))
    .slice(0, 120);
}

function createRawTextSample(text, maxLength = 500) {
  return normalizeWhitespace(text).slice(0, maxLength);
}

function classifyLoginState(finalUrl, bodyText) {
  const urlLooksLogin = LOGIN_URL_REGEX.test(String(finalUrl || ""));
  const textLooksLogin = LOGIN_TEXT_REGEX.test(String(bodyText || ""));
  const textLooksUsage = USAGE_TEXT_REGEX.test(String(bodyText || ""));

  return {
    loginLikely: urlLooksLogin || (textLooksLogin && !textLooksUsage),
    urlLooksLogin,
    textLooksLogin,
    textLooksUsage
  };
}

function classifyTurnstileState(finalUrl, text) {
  const source = `${finalUrl || ""}\n${text || ""}`;

  return {
    turnstileLikely: TURNSTILE_TEXT_REGEX.test(source)
  };
}

function makeParseResult(extraction, overrides = {}) {
  return {
    serviceKey: extraction.serviceKey,
    serviceName: extraction.serviceName,
    ok: false,
    shortWindowPercent: null,
    weeklyPercent: null,
    rawShortWindowPercent: null,
    rawWeeklyPercent: null,
    rawShortWindowMeaning: "unknown",
    rawWeeklyPercentMeaning: "unknown",
    remainingShortWindowPercent: null,
    remainingWeeklyPercent: null,
    usedShortWindowPercent: null,
    usedWeeklyPercent: null,
    shortWindowLabel: null,
    weeklyWindowLabel: null,
    parseMethod: "none",
    parseConfidence: "none",
    rawTextSample: createRawTextSample(extraction.bodyText),
    parsedAt: nowIso(),
    errorReason: null,
    source: extraction.source || null,
    selectedCandidates: {
      shortWindow: null,
      weekly: null
    },
    ...overrides
  };
}

function getCandidateTexts(extraction) {
  const values = [
    ...(Array.isArray(extraction.candidateLines) ? extraction.candidateLines : []),
    ...(Array.isArray(extraction.domCandidates) ? extraction.domCandidates.map((candidate) => candidate.text) : []),
    ...(Array.isArray(extraction.accessibilityCandidates) ? extraction.accessibilityCandidates.map((candidate) => candidate.text) : [])
  ];

  return [...new Set(values.map(normalizeWhitespace).filter(Boolean))];
}

function findPercentCandidates(extraction, options = {}) {
  const bodyLines = String(extraction.bodyText || "")
    .split(/\r?\n/)
    .map(normalizeWhitespace)
    .filter(Boolean);
  const candidateTexts = getCandidateTexts(extraction);
  const lines = [...new Set([...bodyLines, ...candidateTexts])];
  const windowSize = options.windowSize || 2;
  const results = [];

  lines.forEach((line, index) => {
    const matches = line.match(PERCENT_REGEX) || [];

    let match;
    const regex = new RegExp(PERCENT_REGEX.source, "g");

    while ((match = regex.exec(line)) !== null) {
      const token = match[0];
      const percent = percentTokenToNumber(token);

      if (percent === null) {
        continue;
      }

      const start = Math.max(0, index - windowSize);
      const end = Math.min(lines.length, index + windowSize + 1);
      const context = lines.slice(start, end).join(" ");
      const tokenStart = match.index;
      const tokenEnd = tokenStart + token.length;
      const tokenContextStart = Math.max(0, tokenStart - 90);
      const tokenContextEnd = Math.min(line.length, tokenEnd + 90);

      results.push({
        percent,
        token,
        line,
        previousLine: lines[index - 1] || "",
        nextLine: lines[index + 1] || "",
        before: line.slice(0, tokenStart),
        after: line.slice(tokenEnd),
        tokenContext: line.slice(tokenContextStart, tokenContextEnd),
        context
      });
    }
  });

  return results;
}

function hasAntiKeyword(candidate) {
  const text = normalizeWhitespace([
    candidate && candidate.tokenContext,
    candidate && candidate.line,
    candidate && candidate.previousLine,
    candidate && candidate.nextLine
  ].filter(Boolean).join(" ")).toLowerCase();

  return ANTI_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function scoreCandidate(candidate, keywords) {
  if (hasAntiKeyword(candidate)) {
    return 0;
  }

  const line = normalizeWhitespace(candidate.line).toLowerCase();
  const context = normalizeWhitespace(candidate.context).toLowerCase();
  const tokenContext = normalizeWhitespace(candidate.tokenContext || "").toLowerCase();
  const previousLine = normalizeWhitespace(candidate.previousLine || "").toLowerCase();
  const nextLine = normalizeWhitespace(candidate.nextLine || "").toLowerCase();
  const before = normalizeWhitespace(candidate.before || "").toLowerCase();
  const after = normalizeWhitespace(candidate.after || "").toLowerCase();

  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = keyword.toLowerCase();
    const beforeIndex = before.lastIndexOf(normalizedKeyword);
    const afterIndex = after.indexOf(normalizedKeyword);
    const beforeDistance = beforeIndex >= 0 ? before.length - beforeIndex : null;
    const afterDistance = afterIndex >= 0 ? afterIndex : null;
    const beforeScore = beforeDistance !== null ? Math.max(2, 12 - Math.floor(beforeDistance / 24)) : 0;
    const afterScore = afterDistance !== null ? Math.max(1, 6 - Math.floor(afterDistance / 24)) : 0;
    const previousLineScore = previousLine.includes(normalizedKeyword) ? 10 : 0;
    const nextLineScore = nextLine.includes(normalizedKeyword) ? 4 : 0;
    const tokenScore = tokenContext.includes(normalizedKeyword) ? 2 : 0;
    const lineScore = line.includes(normalizedKeyword) ? 1 : 0;
    const contextScore = context.includes(normalizedKeyword) ? 1 : 0;
    return score + beforeScore + afterScore + previousLineScore + nextLineScore + tokenScore + lineScore + contextScore;
  }, 0);
}

function pickBestPercent(candidates, keywords) {
  const scored = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate, keywords)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

function safeCandidateContext(candidate) {
  if (!candidate) {
    return null;
  }

  return {
    percent: candidate.percent,
    token: candidate.token,
    score: candidate.score || 0,
    context: normalizeWhitespace(candidate.tokenContext || candidate.line || candidate.context).slice(0, 240),
    previousLine: normalizeWhitespace(candidate.previousLine || "").slice(0, 160),
    nextLine: normalizeWhitespace(candidate.nextLine || "").slice(0, 160)
  };
}

function usedFromRaw(rawPercent, meaning) {
  if (rawPercent === null || rawPercent === undefined) {
    return null;
  }

  if (meaning === "used") {
    return rawPercent;
  }

  if (meaning === "remaining") {
    return 100 - rawPercent;
  }

  return null;
}

function inferPercentMeaning(candidate, fallback = "unknown") {
  const text = normalizeWhitespace([
    candidate && candidate.tokenContext,
    candidate && candidate.line,
    candidate && candidate.context
  ].filter(Boolean).join(" ")).toLowerCase();

  if (/remaining|left|available|남음|남은|남았습니다|잔여|남아/.test(text)) {
    return "remaining";
  }

  if (/\bused\b|사용됨|사용한|사용 중|사용량/.test(text)) {
    return "used";
  }

  return fallback;
}

function inferErrorReason(extraction, percentCandidates) {
  if (extraction.turnstileState && extraction.turnstileState.turnstileLikely) {
    return "turnstile_verification_required";
  }

  if (extraction.error && extraction.error.reason === "page_timeout") {
    return "page_timeout";
  }

  if (extraction.loginState && extraction.loginState.loginLikely) {
    return "login_required";
  }

  if (!extraction.loginState || !extraction.loginState.textLooksUsage) {
    return "usage_text_not_found";
  }

  if (!percentCandidates || percentCandidates.length === 0) {
    return "percent_not_found";
  }

  return "parser_low_confidence";
}

module.exports = {
  ANTI_KEYWORDS,
  classifyLoginState,
  classifyTurnstileState,
  createRawTextSample,
  extractCandidateLines,
  extractPercentTokens,
  findPercentCandidates,
  getCandidateTexts,
  hasAntiKeyword,
  inferPercentMeaning,
  inferErrorReason,
  makeParseResult,
  normalizeWhitespace,
  percentTokenToNumber,
  pickBestPercent,
  remainingFromRaw,
  safeCandidateContext,
  scoreCandidate,
  usedFromRaw
};
