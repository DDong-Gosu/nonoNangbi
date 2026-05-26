const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FALLBACK_NPM_PATHS = [
  "/opt/homebrew/bin/npm",
  "/usr/local/bin/npm",
  "npm"
];

function shellQuote(value) {
  return `"${String(value).replace(/(["\\$`])/g, "\\$1")}"`;
}

function executableExists(filePath) {
  if (!filePath || filePath === "npm") {
    return false;
  }

  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function detectNpmPath() {
  try {
    const detected = execFileSync("which", ["npm"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();

    if (detected) {
      return {
        npmPath: detected,
        source: "PATH"
      };
    }
  } catch {
  }

  const existingFallback = FALLBACK_NPM_PATHS.find(executableExists);

  return {
    npmPath: existingFallback || FALLBACK_NPM_PATHS[FALLBACK_NPM_PATHS.length - 1],
    source: "fallback"
  };
}

function printScript(npmPath) {
  console.log(`cd ${shellQuote(PROJECT_ROOT)}`);
  console.log(`${shellQuote(npmPath)} run start:chrome`);
}

function main() {
  const detected = detectNpmPath();
  const commandPath = path.join(PROJECT_ROOT, "Mongi Start.command");

  console.log("Mongi Launcher Guide");
  console.log("");
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log(`Detected npm path: ${detected.npmPath}`);
  console.log(`Detection source: ${detected.source}`);

  if (detected.source === "fallback") {
    console.log(`Fallback candidates: ${FALLBACK_NPM_PATHS.join(", ")}`);
  }

  console.log("");
  console.log("Automator app shell script:");
  console.log("");
  printScript(detected.npmPath);
  console.log("");
  console.log("Shortcuts shell script:");
  console.log("");
  printScript(detected.npmPath);
  console.log("");
  console.log(".command fallback:");
  console.log(commandPath);
  console.log("");
  console.log("Recommended daily flow:");
  console.log("1. Click Mongi Start.app after opening your Mac.");
  console.log("2. Confirm Codex/Claude usage pages are visible.");
  console.log("3. Let launchd run monitor every 10 minutes.");
  console.log("4. If unsure, run npm run health.");
}

main();
