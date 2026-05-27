const {
  findPercentCandidates,
  inferPercentMeaning,
  inferErrorReason,
  makeParseResult,
  pickBestPercent,
  remainingFromRaw,
  usedFromRaw
} = require("./common");

const SHORT_WINDOW_KEYWORDS = [
  "5h",
  "5 h",
  "5-hour",
  "5 hour",
  "5시간",
  "5 시간",
  "five hour",
  "five-hour",
  "short",
  "window",
  "5시간 사용",
  "5-hour usage",
  "단기"
];

const WEEKLY_KEYWORDS = [
  "weekly usage",
  "weekly limit",
  "weekly",
  "week",
  "7 day",
  "7-day",
  "주간 사용",
  "주간 한도",
  "주간",
  "주 단위"
];

function parseCodexUsage(extraction) {
  if (extraction.turnstileState && extraction.turnstileState.turnstileLikely) {
    return makeParseResult(extraction, {
      parseMethod: "turnstile_detection",
      errorReason: "turnstile_verification_required"
    });
  }

  if (extraction.error) {
    return makeParseResult(extraction, {
      parseMethod: "navigation",
      errorReason: extraction.error.reason || "unknown_page_structure"
    });
  }

  const percentCandidates = findPercentCandidates(extraction);
  const shortCandidate = pickBestPercent(percentCandidates, SHORT_WINDOW_KEYWORDS);
  const weeklyCandidate = pickBestPercent(percentCandidates, WEEKLY_KEYWORDS);
  const fallbackCandidate = percentCandidates[0] || null;
  const shortWindowPercent = shortCandidate ? shortCandidate.percent : null;
  const weeklyPercent = weeklyCandidate ? weeklyCandidate.percent : null;
  const fallbackPercent = shortWindowPercent === null && weeklyPercent === null && fallbackCandidate ? fallbackCandidate.percent : null;
  const rawShortWindowPercent = shortWindowPercent !== null ? shortWindowPercent : fallbackPercent;
  const rawWeeklyPercent = weeklyPercent;
  const rawShortWindowMeaning = rawShortWindowPercent !== null ? inferPercentMeaning(shortCandidate || fallbackCandidate, "remaining") : "unknown";
  const rawWeeklyPercentMeaning = rawWeeklyPercent !== null ? inferPercentMeaning(weeklyCandidate, "remaining") : "unknown";
  const foundAny = shortWindowPercent !== null || weeklyPercent !== null || fallbackPercent !== null;

  if (!foundAny) {
    return makeParseResult(extraction, {
      parseMethod: "innerText+dom",
      errorReason: inferErrorReason(extraction, percentCandidates)
    });
  }

  const bothLabeled = shortWindowPercent !== null && weeklyPercent !== null;
  const oneLabeled = shortWindowPercent !== null || weeklyPercent !== null;

  return makeParseResult(extraction, {
    ok: true,
    shortWindowPercent: rawShortWindowPercent,
    weeklyPercent: rawWeeklyPercent,
    rawShortWindowPercent,
    rawWeeklyPercent,
    rawShortWindowMeaning,
    rawWeeklyPercentMeaning,
    remainingShortWindowPercent: remainingFromRaw(rawShortWindowPercent, rawShortWindowMeaning),
    remainingWeeklyPercent: remainingFromRaw(rawWeeklyPercent, rawWeeklyPercentMeaning),
    usedShortWindowPercent: usedFromRaw(rawShortWindowPercent, rawShortWindowMeaning),
    usedWeeklyPercent: usedFromRaw(rawWeeklyPercent, rawWeeklyPercentMeaning),
    shortWindowLabel: rawShortWindowPercent !== null ? "5-hour remaining" : null,
    weeklyWindowLabel: rawWeeklyPercent !== null ? "weekly remaining" : null,
    parseMethod: "codex_label_heuristic",
    parseConfidence: bothLabeled ? "high" : oneLabeled ? "medium" : "low",
    errorReason: null
  });
}

module.exports = {
  parseCodexUsage
};
