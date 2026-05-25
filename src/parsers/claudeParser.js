const {
  findPercentCandidates,
  inferErrorReason,
  makeParseResult,
  pickBestPercent
} = require("./common");

const SHORT_WINDOW_KEYWORDS = [
  "5h",
  "5 h",
  "5 hour",
  "five hour",
  "hour",
  "hours",
  "remaining",
  "limit",
  "시간",
  "남음",
  "한도"
];

const WEEKLY_KEYWORDS = [
  "weekly",
  "week",
  "reset",
  "claude code",
  "usage",
  "주간",
  "주",
  "재설정",
  "사용량"
];

function parseClaudeUsage(extraction) {
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
    shortWindowPercent: shortWindowPercent !== null ? shortWindowPercent : fallbackPercent,
    weeklyPercent,
    parseMethod: "claude_label_heuristic",
    parseConfidence: bothLabeled ? "high" : oneLabeled ? "medium" : "low",
    errorReason: null
  });
}

module.exports = {
  parseClaudeUsage
};
