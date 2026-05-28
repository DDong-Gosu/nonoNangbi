// Content script (Phase G Spike 3).
// Runs in the Claude/Codex usage page, extracts usage from the DOM, and
// forwards it to the background service worker. Handles SPA route changes and
// late hydration by re-extracting on DOM mutations (debounced) and on an
// interval.

(function () {
  const SEND_MIN_INTERVAL_MS = 15000;
  let lastSent = 0;
  let lastPayload = null;

  function send(reason) {
    const usage = window.MongiExtract.extractUsage(document);
    // only send when we actually found something and not too frequently
    if (usage.shortRemaining == null && usage.weeklyRemaining == null) return;
    const now = Date.now();
    const sig = `${usage.service}:${usage.shortRemaining}:${usage.weeklyRemaining}`;
    if (sig === lastPayload && now - lastSent < SEND_MIN_INTERVAL_MS) return;
    lastSent = now;
    lastPayload = sig;
    usage.reason = reason;
    try {
      chrome.runtime.sendMessage({ type: "mongi-usage", usage });
    } catch (_) {
      /* SW may be asleep; background reopens on next event */
    }
  }

  // initial + after hydration
  setTimeout(() => send("initial"), 1500);

  // SPA hydration / route changes
  const mo = new MutationObserver(() => {
    clearTimeout(mo._t);
    mo._t = setTimeout(() => send("mutation"), 800);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // periodic refresh (covers idle pages)
  setInterval(() => send("interval"), 60000);
})();
