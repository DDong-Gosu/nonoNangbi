const DEFAULT_POLICY = Object.freeze({
  notifications: Object.freeze({
    recoveredShort: true,
    recoveredWeekly: true,
    sessionStopped: true,
    weeklyIdle: true,
    diagnostics: true
  }),
  thresholds: Object.freeze({
    sessionStoppedMinutes: 20,
    weeklyIdleReminderHours: 4,
    diagnosticReminderHours: 6
  }),
  quietHours: Object.freeze({
    enabled: true,
    startHour: 23,
    endHour: 8
  }),
  message: Object.freeze({
    intensity: "normal"
  }),
  services: Object.freeze({
    codex: Object.freeze({
      enabled: true,
      weeklyIdleEnabled: true
    }),
    claude: Object.freeze({
      enabled: true,
      weeklyIdleEnabled: true
    })
  })
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultPolicy() {
  return clone(DEFAULT_POLICY);
}

module.exports = {
  getDefaultPolicy
};
