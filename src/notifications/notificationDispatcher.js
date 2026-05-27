const { sendDiscordMessage } = require("./discord");
const { getEventMessage } = require("./messages");
const { isQuietHours } = require("../events/eventDetector");

const DISCORD_EVENT_TYPES = new Set([
  "recovered_short",
  "recovered_weekly",
  "session_stopped",
  "weekly_idle",
  "parse_failure_digest",
  "cdp_unreachable_digest"
]);

const EVENT_POLICY_KEYS = {
  recovered_short: "recoveredShort",
  recovered_weekly: "recoveredWeekly",
  session_stopped: "sessionStopped",
  weekly_idle: "weeklyIdle",
  parse_failure_digest: "diagnostics",
  cdp_unreachable_digest: "diagnostics"
};

function notificationEnabled(config, eventType) {
  const policyKey = EVENT_POLICY_KEYS[eventType];

  if (!policyKey || !config.policy || !config.policy.notifications) {
    return true;
  }

  return config.policy.notifications[policyKey] !== false;
}

function patchForSentEvent(event) {
  const servicePatch = {};
  const metaPatch = {};

  if (event.type === "recovered_short") {
    servicePatch.lastShortRecoveredAt = event.occurredAt;
  }

  if (event.type === "recovered_weekly") {
    servicePatch.lastWeeklyRecoveredAt = event.occurredAt;
  }

  if (event.type === "session_stopped") {
    servicePatch.sessionSummarySent = true;
  }

  if (event.type === "weekly_idle") {
    servicePatch.lastWeeklyFullReminderAt = event.occurredAt;
  }

  if (event.type === "parse_failure_digest") {
    servicePatch.lastParseFailureDigestAt = event.occurredAt;
  }

  if (event.type === "cdp_unreachable_digest") {
    metaPatch.lastCdpUnreachableDigestAt = event.occurredAt;
  }

  return {
    serviceKey: event.serviceKey,
    servicePatch,
    metaPatch
  };
}

async function dispatchNotifications({ config, events, now = new Date(), dryRun = false, sender = sendDiscordMessage, logger = null, output = null, usage = null }) {
  const results = [];
  const quiet = isQuietHours(config, now);

  for (const event of events) {
    if (!DISCORD_EVENT_TYPES.has(event.type)) {
      results.push({
        event,
        sent: false,
        suppressed: event.type === "usage_active" ? "usage_active" : "not_dispatchable",
        message: null,
        patch: null
      });
      continue;
    }

    if (!notificationEnabled(config, event.type)) {
      results.push({
        event,
        sent: false,
        suppressed: "policy_disabled",
        message: null,
        patch: null
      });
      continue;
    }

    if (quiet) {
      results.push({
        event,
        sent: false,
        suppressed: "quiet_hours",
        message: null,
        patch: null
      });
      continue;
    }

    const message = getEventMessage(event, { output, usage });

    if (dryRun) {
      results.push({
        event,
        sent: false,
        suppressed: "dry_run",
        message,
        patch: null
      });

      if (logger) {
        logger.info("DRY RUN: Would have sent Discord notification.", {
          eventType: event.type,
          serviceKey: event.serviceKey,
          messagePreview: message.slice(0, 120)
        });
      }

      continue;
    }

    await sender(config, message);
    const patch = patchForSentEvent(event);
    results.push({
      event,
      sent: true,
      suppressed: null,
      message,
      patch
    });

    if (logger) {
      logger.info("Discord event notification dispatched.", {
        eventType: event.type,
        serviceKey: event.serviceKey
      });
    }
  }

  return results;
}

function applyNotificationPatches(state, dispatchResults) {
  for (const result of dispatchResults) {
    if (!result.patch || !result.sent) {
      continue;
    }

    if (result.patch.serviceKey && state.services[result.patch.serviceKey]) {
      Object.assign(state.services[result.patch.serviceKey], result.patch.servicePatch);
    }

    state.meta = state.meta || {};
    Object.assign(state.meta, result.patch.metaPatch);
  }
}

module.exports = {
  applyNotificationPatches,
  dispatchNotifications
};
