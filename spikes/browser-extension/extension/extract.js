// Shared DOM usage extractor (Phase G Spike 3).
// Self-contained so it can run both as a content script and be evaluated
// directly against a live DOM via CDP for testing.
//
// Strategy: collect every element whose text is a "NN%" and capture the
// surrounding text (self + parent + previous sibling) as context, then label
// each percent as short-window vs weekly using keyword anchors. This is the
// same heuristic family as Mongi's CDP parser but uses real DOM structure
// instead of flattened innerText, which gives cleaner context.

(function (root) {
  const SHORT_RE = /current\s*session|현재\s*세션|세션|5\s*-?\s*hour|5\s*시간|단기/i;
  const WEEKLY_RE = /all\s*models?|모든\s*모델|전체\s*모델|weekly|주간|주\s*단위|7\s*-?\s*day/i;
  const USED_RE = /used|사용/i;
  const REMAINING_RE = /remaining|left|남음|남은/i;

  function nodeContext(el) {
    const parts = [];
    if (el.previousElementSibling)
      parts.push(el.previousElementSibling.textContent || "");
    if (el.parentElement) parts.push(el.parentElement.textContent || "");
    let p = el.parentElement;
    for (let i = 0; i < 2 && p && p.parentElement; i++) {
      p = p.parentElement;
      parts.push(p.textContent || "");
    }
    return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 240);
  }

  function collectCandidates(doc) {
    const out = [];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let n;
    while ((n = walker.nextNode())) {
      const text = (n.nodeValue || "").trim();
      const m = text.match(/(\d{1,3})\s*%/);
      if (!m) continue;
      const pct = parseInt(m[1], 10);
      if (pct < 0 || pct > 100) continue;
      const el = n.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      out.push({ percent: pct, context: nodeContext(el) });
    }
    return out;
  }

  function meaning(ctx) {
    if (REMAINING_RE.test(ctx)) return "remaining";
    if (USED_RE.test(ctx)) return "used";
    return "unknown";
  }

  function toRemaining(pct, mean) {
    if (pct == null) return null;
    return mean === "remaining" ? pct : 100 - pct;
  }

  function pick(cands, re, antiRe) {
    const scored = cands
      .map((c) => ({
        ...c,
        score: (re.test(c.context) ? 2 : 0) - (antiRe.test(c.context) ? 1 : 0),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored[0] || null;
  }

  function extractUsage(doc) {
    doc = doc || document;
    const host = (doc.location && doc.location.host) || "";
    const service = /claude\.ai/.test(host)
      ? "claude"
      : /chatgpt\.com/.test(host)
        ? "codex"
        : "unknown";
    const cands = collectCandidates(doc);
    const shortC = pick(cands, SHORT_RE, WEEKLY_RE);
    const weeklyC = pick(cands, WEEKLY_RE, SHORT_RE);
    return {
      service,
      capturedAt: new Date().toISOString(),
      candidateCount: cands.length,
      shortRemaining: shortC
        ? toRemaining(shortC.percent, meaning(shortC.context))
        : null,
      weeklyRemaining: weeklyC
        ? toRemaining(weeklyC.percent, meaning(weeklyC.context))
        : null,
      method: "extension_dom_treewalker",
      confidence: shortC && weeklyC ? "high" : shortC || weeklyC ? "medium" : "low",
    };
  }

  root.MongiExtract = { extractUsage };
})(typeof window !== "undefined" ? window : globalThis);
