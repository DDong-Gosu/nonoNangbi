const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = process.env.CHROME_CDP_PORT || "9222";
const userDataDir = process.env.CHROME_USER_DATA_DIR || "$HOME/.mongi-chrome-profile";

const command = `"${chromePath}" \\
  --remote-debugging-port=${port} \\
  --user-data-dir="${userDataDir}"`;

console.log(command);
