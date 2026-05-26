const { nowIso } = require("../utils/time");

const PERCENT_REGEX = /(?:100|[1-9]?\d)(?:\.\d+)?\s*%/g;
const LOGIN_URL_REGEX = /login|signin|sign-in|auth|oauth|account\/login/i;
const LOGIN_TEXT_REGEX = /sign in|log in|login|continue with|authenticate|authentication|verify your email|로그인|인증|계정에 로그인/i;
const USAGE_TEXT_REGEX = /usage|limit|remaining|reset|week|weekly|hour|hours|5h|사용량|사용|한도|남음|재설정|주간|시간/i;
const TURNSTILE_TEXT_REGEX = /cloudflare|turnstile|verify you are human|checking if the site connection is secure|사람인지 확인하십시오|사람인지 확인하세요|보안 확인 수행 중/i;

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
    parseMethod: "none",
    parseConfidence: "none",
    rawTextSample: createRawTextSample(extraction.bodyText),
    parsedAt: nowIso(),
    errorReason: null,
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

    matches.forEach((token) => {
      const percent = percentTokenToNumber(token);

      if (percent === null) {
        return;
      }

      const start = Math.max(0, index - windowSize);
      const end = Math.min(lines.length, index + windowSize + 1);
      const context = lines.slice(start, end).join(" ");

      results.push({
        percent,
        token,
        line,
        context
      });
    });
  });

  return results;
}

function scoreCandidate(candidate, keywords) {
  const line = normalizeWhitespace(candidate.line).toLowerCase();
  const context = normalizeWhitespace(candidate.context).toLowerCase();
  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = keyword.toLowerCase();
    const lineScore = line.includes(normalizedKeyword) ? 2 : 0;
    const contextScore = context.includes(normalizedKeyword) ? 1 : 0;
    return score + lineScore + contextScore;
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
  classifyLoginState,
  classifyTurnstileState,
  createRawTextSample,
  extractCandidateLines,
  extractPercentTokens,
  findPercentCandidates,
  getCandidateTexts,
  inferErrorReason,
  makeParseResult,
  normalizeWhitespace,
  percentTokenToNumber,
  pickBestPercent,
  remainingFromRaw,
  scoreCandidate
};
