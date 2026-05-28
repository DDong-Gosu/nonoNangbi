// Background service worker (Phase G Spike 3).
// Receives usage from content scripts and forwards to the Mongi native host.
// MV3 service workers are killed when idle, so this stays event-driven and
// uses chrome.alarms as a heartbeat rather than a long-lived timer.

const NATIVE_HOST = "com.mongi.bridge";

function forwardToNative(usage) {
  try {
    // one-shot message; native host appends to its JSONL bridge file
    chrome.runtime.sendNativeMessage(NATIVE_HOST, usage, (resp) => {
      if (chrome.runtime.lastError) {
        // native host not installed during spike -> cache in storage instead
        chrome.storage.local.set({ lastUsage: usage, lastError: chrome.runtime.lastError.message });
      }
    });
  } catch (e) {
    chrome.storage.local.set({ lastUsage: usage, lastError: String(e) });
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "mongi-usage" && msg.usage) {
    chrome.storage.local.set({ lastUsage: msg.usage });
    forwardToNative(msg.usage);
  }
});

// heartbeat: re-evaluate cached usage staleness; could ping content tabs
chrome.alarms.create("mongi-heartbeat", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name !== "mongi-heartbeat") return;
  chrome.storage.local.get("lastUsage", () => {
    /* a real impl would re-poll or mark stale here */
  });
});
