const fs = require("fs");
const path = require("path");

const { getDefaultPolicy } = require("./defaultPolicy");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_POLICY_PATH = path.join(PROJECT_ROOT, "config/policy.json");
const ALLOWED_INTENSITIES = new Set(["calm", "normal", "firm"]);

const POLICY_SCHEMA = {
  notifications: {
    recoveredShort: "boolean",
    recoveredWeekly: "boolean",
    sessionStopped: "boolean",
    weeklyIdle: "boolean",
    diagnostics: "boolean"
  },
  thresholds: {
    sessionStoppedMinutes: "positiveNumber",
    weeklyIdleReminderHours: "positiveNumber",
    diagnosticReminderHours: "positiveNumber"
  },
  quietHours: {
    enabled: "boolean",
    startHour: "hour",
    endHour: "hour"
  },
  message: {
    intensity: "intensity"
  },
  services: {
    codex: {
      enabled: "boolean",
      weeklyIdleEnabled: "boolean"
    },
    claude: {
      enabled: "boolean",
      weeklyIdleEnabled: "boolean"
    }
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function displayPath(parts) {
  return parts.join(".");
}

function isValidByType(value, type) {
  if (type === "boolean") {
    return typeof value === "boolean";
  }

  if (type === "positiveNumber") {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }

  if (type === "hour") {
    return Number.isInteger(value) && value >= 0 && value <= 23;
  }

  if (type === "intensity") {
    return typeof value === "string" && ALLOWED_INTENSITIES.has(value);
  }

  return false;
}

function mergeNode(defaultNode, localNode, schemaNode, pathParts, warnings) {
  if (typeof schemaNode === "string") {
    if (localNode === undefined) {
      return clone(defaultNode);
    }

    if (!isValidByType(localNode, schemaNode)) {
      warnings.push(`${displayPath(pathParts)} is invalid. Using default value.`);
      return clone(defaultNode);
    }

    return clone(localNode);
  }

  const merged = {};
  const localObject = isPlainObject(localNode) ? localNode : {};

  if (localNode !== undefined && !isPlainObject(localNode)) {
    warnings.push(`${displayPath(pathParts)} must be an object. Using default values.`);
  }

  for (const key of Object.keys(schemaNode)) {
    merged[key] = mergeNode(
      defaultNode[key],
      localObject[key],
      schemaNode[key],
      [...pathParts, key],
      warnings
    );
  }

  for (const key of Object.keys(localObject)) {
    if (!Object.prototype.hasOwnProperty.call(schemaNode, key)) {
      warnings.push(`${displayPath([...pathParts, key])} is unknown and was ignored.`);
    }
  }

  return merged;
}

function mergePolicy(defaultPolicy, localPolicy) {
  const warnings = [];

  if (localPolicy === undefined || localPolicy === null) {
    return {
      policy: clone(defaultPolicy),
      warnings
    };
  }

  if (!isPlainObject(localPolicy)) {
    return {
      policy: clone(defaultPolicy),
      warnings: ["policy root must be an object. Using default policy."]
    };
  }

  const policy = mergeNode(defaultPolicy, localPolicy, POLICY_SCHEMA, [], warnings);

  return {
    policy,
    warnings
  };
}

function validateNode(node, schemaNode, pathParts, warnings) {
  if (typeof schemaNode === "string") {
    if (!isValidByType(node, schemaNode)) {
      warnings.push(`${displayPath(pathParts)} is invalid.`);
    }

    return;
  }

  if (!isPlainObject(node)) {
    warnings.push(`${displayPath(pathParts)} must be an object.`);
    return;
  }

  for (const key of Object.keys(schemaNode)) {
    validateNode(node[key], schemaNode[key], [...pathParts, key], warnings);
  }

  for (const key of Object.keys(node)) {
    if (!Object.prototype.hasOwnProperty.call(schemaNode, key)) {
      warnings.push(`${displayPath([...pathParts, key])} is unknown.`);
    }
  }
}

function validatePolicy(policy) {
  const warnings = [];

  if (!isPlainObject(policy)) {
    return ["policy root must be an object."];
  }

  validateNode(policy, POLICY_SCHEMA, [], warnings);
  return warnings;
}

function readLocalPolicy(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");

  try {
    return JSON.parse(raw);
  } catch (error) {
    const parseError = new Error(`Invalid policy JSON at ${path.relative(PROJECT_ROOT, filePath)}: ${error.message}`);
    parseError.code = "POLICY_JSON_INVALID";
    throw parseError;
  }
}

function loadPolicy(options = {}) {
  const policyPath = path.resolve(PROJECT_ROOT, options.policyPath || DEFAULT_POLICY_PATH);
  const strictJson = Boolean(options.strictJson);
  const defaultPolicy = getDefaultPolicy();
  const warnings = [];

  if (!fs.existsSync(policyPath)) {
    return {
      policy: defaultPolicy,
      warnings,
      source: "default",
      policyPath
    };
  }

  let localPolicy;

  try {
    localPolicy = readLocalPolicy(policyPath);
  } catch (error) {
    if (strictJson) {
      throw error;
    }

    return {
      policy: defaultPolicy,
      warnings: [`${error.message}. Using default policy.`],
      source: "default-with-invalid-local",
      policyPath,
      error: {
        code: error.code || "POLICY_LOAD_FAILED",
        message: error.message
      }
    };
  }

  const merged = mergePolicy(defaultPolicy, localPolicy);
  const validationWarnings = validatePolicy(merged.policy);

  warnings.push(...merged.warnings, ...validationWarnings);

  return {
    policy: merged.policy,
    warnings,
    source: "local",
    policyPath
  };
}

function summarizePolicy(policy) {
  return {
    notifications: {
      recoveredShort: policy.notifications.recoveredShort,
      recoveredWeekly: policy.notifications.recoveredWeekly,
      sessionStopped: policy.notifications.sessionStopped,
      weeklyIdle: policy.notifications.weeklyIdle,
      diagnostics: policy.notifications.diagnostics
    },
    thresholds: {
      sessionStoppedMinutes: policy.thresholds.sessionStoppedMinutes,
      weeklyIdleReminderHours: policy.thresholds.weeklyIdleReminderHours,
      diagnosticReminderHours: policy.thresholds.diagnosticReminderHours
    },
    quietHours: {
      enabled: policy.quietHours.enabled,
      startHour: policy.quietHours.startHour,
      endHour: policy.quietHours.endHour
    },
    message: {
      intensity: policy.message.intensity
    },
    services: {
      codex: {
        enabled: policy.services.codex.enabled,
        weeklyIdleEnabled: policy.services.codex.weeklyIdleEnabled
      },
      claude: {
        enabled: policy.services.claude.enabled,
        weeklyIdleEnabled: policy.services.claude.weeklyIdleEnabled
      }
    }
  };
}

module.exports = {
  getDefaultPolicy,
  loadPolicy,
  mergePolicy,
  summarizePolicy,
  validatePolicy
};
