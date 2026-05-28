const {
  findPercentCandidates,
  inferPercentMeaning,
  inferErrorReason,
  makeParseResult,
  pickBestPercent,
  remainingFromRaw,
  safeCandidateContext,
  usedFromRaw
} = require("./common");

const SHORT_WINDOW_KEYWORDS = [
  "current session",
  "session",
  "현재 세션",
  "현재 사용량",
  "현재",
  "세션",
  "5h",
  "5 h",
  "5-hour",
  "5 hour",
  "five hour",
  "5시간",
  "단기"
];

const WEEKLY_KEYWORDS = [
  "all models",
  "all-models",
  "all model",
  "models",
  "model usage",
  "모든 모델",
  "전체 모델",
  "모델",
  "weekly usage",
  "weekly",
  "week",
  "claude code",
  "주간",
  "주 단위"
];

const SHORT_ANCHOR_REGEX = /current\s*session|현재\s*세션|세션/i;
const WEEKLY_ANCHOR_REGEX = /all\s*models?|모든\s*모델|전체\s*모델/i;

function pickClaudePercent(candidates, keywords, anchorRegex, rejectRegex) {
  const scored = candidates
    .map((candidate) => {
      const base = pickBestPercent([candidate], keywords);

      if (!base) {
        return null;
      }

      const context = [
        candidate.previousLine,
        candidate.line,
        candidate.nextLine,
        candidate.context
      ].filter(Boolean).join(" ");
      const anchorBoost = anchorRegex.test(context) ? 30 : 0;
      const rejectPenalty = rejectRegex && rejectRegex.test(context) ? 20 : 0;

      return {
        ...base,
        score: base.score + anchorBoost - rejectPenalty
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

function parseClaudeUsage(extraction) {
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
  const shortCandidate = pickClaudePercent(percentCandidates, SHORT_WINDOW_KEYWORDS, SHORT_ANCHOR_REGEX, WEEKLY_ANCHOR_REGEX);
  const weeklyCandidate = pickClaudePercent(percentCandidates, WEEKLY_KEYWORDS, WEEKLY_ANCHOR_REGEX, SHORT_ANCHOR_REGEX);
  const shortWindowPercent = shortCandidate ? shortCandidate.percent : null;
  const weeklyPercent = weeklyCandidate ? weeklyCandidate.percent : null;
  const rawShortWindowPercent = shortWindowPercent;
  const rawWeeklyPercent = weeklyPercent;
  const rawShortWindowMeaning = shortCandidate ? inferPercentMeaning(shortCandidate, "used") : "unknown";
  const rawWeeklyPercentMeaning = weeklyCandidate ? inferPercentMeaning(weeklyCandidate, "used") : "unknown";
  const foundAny = shortWindowPercent !== null || weeklyPercent !== null;

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
    shortWindowLabel: rawShortWindowPercent !== null ? "current session used" : null,
    weeklyWindowLabel: rawWeeklyPercent !== null ? "all-models used" : null,
    parseMethod: "claude_label_heuristic",
    parseConfidence: bothLabeled ? "high" : oneLabeled ? "medium" : "low",
    selectedCandidates: {
      shortWindow: safeCandidateContext(shortCandidate),
      weekly: safeCandidateContext(weeklyCandidate)
    },
    errorReason: null
  });
}

module.exports = {
  parseClaudeUsage
};
