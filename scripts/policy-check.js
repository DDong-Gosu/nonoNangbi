const path = require("path");

const { loadPolicy, summarizePolicy } = require("../src/policy/policyStore");

function enabled(value) {
  return value ? "enabled" : "disabled";
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function windowText(quietHours) {
  if (!quietHours.enabled) {
    return "disabled";
  }

  return `${String(quietHours.startHour).padStart(2, "0")}:00-${String(quietHours.endHour).padStart(2, "0")}:00`;
}

function main() {
  const result = loadPolicy({ strictJson: true });
  const policy = summarizePolicy(result.policy);

  console.log("Current Mongi Policy");
  console.log("");
  console.log(`Source: ${result.source}`);
  console.log(`Path: ${path.relative(process.cwd(), result.policyPath)}`);
  console.log("");
  console.log("Notifications:");
  console.log(`- recovered short: ${enabled(policy.notifications.recoveredShort)}`);
  console.log(`- recovered weekly: ${enabled(policy.notifications.recoveredWeekly)}`);
  console.log(`- session stopped: ${enabled(policy.notifications.sessionStopped)}`);
  console.log(`- weekly idle: ${enabled(policy.notifications.weeklyIdle)}`);
  console.log(`- diagnostics: ${enabled(policy.notifications.diagnostics)}`);
  console.log("");
  console.log("Thresholds:");
  console.log(`- session stopped: ${policy.thresholds.sessionStoppedMinutes} min`);
  console.log(`- weekly idle reminder: ${policy.thresholds.weeklyIdleReminderHours} hours`);
  console.log(`- diagnostic reminder: ${policy.thresholds.diagnosticReminderHours} hours`);
  console.log("");
  console.log("Quiet hours:");
  console.log(`- enabled: ${yesNo(policy.quietHours.enabled)}`);
  console.log(`- window: ${windowText(policy.quietHours)}`);
  console.log("");
  console.log("Services:");
  console.log(`- Codex: ${enabled(policy.services.codex.enabled)}, weekly idle ${enabled(policy.services.codex.weeklyIdleEnabled)}`);
  console.log(`- Claude: ${enabled(policy.services.claude.enabled)}, weekly idle ${enabled(policy.services.claude.weeklyIdleEnabled)}`);
  console.log("");
  console.log("Message:");
  console.log(`- intensity: ${policy.message.intensity}`);
  console.log("");
  console.log("Warnings:");

  if (result.warnings.length === 0) {
    console.log("- none");
    return;
  }

  for (const warning of result.warnings) {
    console.log(`- ${warning}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Policy check failed: ${error.message}`);
  process.exit(1);
}
