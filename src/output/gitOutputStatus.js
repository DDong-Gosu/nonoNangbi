const { execFileSync } = require("child_process");

const OUTPUT_STATUSES = Object.freeze({
  NO_OUTPUT: "NO_OUTPUT",
  LOCAL_ONLY: "LOCAL_ONLY",
  SHIPPED: "SHIPPED"
});

const SHIPPED_DETECTION_LIMITATION = "Remote/upstream commit date is used as a proxy for GitHub push time and may be stale if refs were not fetched.";

function runGit(args, cwd) {
  try {
    return {
      ok: true,
      stdout: execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }).trim()
    };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout ? String(error.stdout).trim() : "",
      stderr: error.stderr ? String(error.stderr).trim() : "",
      code: error.status || 1
    };
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDateKey(date) {
  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function parseCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function classifyOutputStatus({ hasShippedToday, hasLocalChanges, hasUnpushedCommits, gitAvailable, quietHoursActive, reason }) {
  let outputStatus = OUTPUT_STATUSES.NO_OUTPUT;
  let decisionReason = reason || "no_git_output_detected";

  if (hasShippedToday) {
    outputStatus = OUTPUT_STATUSES.SHIPPED;
    decisionReason = "shipped_evidence_today";
  } else if (hasLocalChanges || hasUnpushedCommits) {
    outputStatus = OUTPUT_STATUSES.LOCAL_ONLY;
    decisionReason = hasLocalChanges ? "local_working_tree_changes" : "local_commits_not_shipped";
  } else if (!gitAvailable) {
    decisionReason = reason || "not_a_git_repository";
  }

  return {
    outputStatus,
    reason: decisionReason,
    quietHoursActive: Boolean(quietHoursActive)
  };
}

function createOutputStatusResult(overrides = {}) {
  return {
    outputStatus: OUTPUT_STATUSES.NO_OUTPUT,
    checkedAt: null,
    hasLocalChanges: false,
    hasUnpushedCommits: false,
    hasShippedToday: false,
    quietHoursActive: false,
    reason: "not_checked",
    repository: {
      available: false,
      root: null,
      branch: null,
      upstream: null
    },
    details: {
      hasHead: false,
      aheadCount: 0,
      behindCount: 0,
      localCommitCount: 0,
      upstreamLatestCommitAt: null,
      shippedDetectionSource: "git_upstream_commit_date_proxy",
      shippedDetectionLimitation: SHIPPED_DETECTION_LIMITATION
    },
    ...overrides
  };
}

function getGitOutputStatus(options = {}) {
  const cwd = options.cwd || process.cwd();
  const now = options.now ? new Date(options.now) : new Date();
  const checkedAt = now.toISOString();
  const todayKey = localDateKey(now);
  const quietHoursActive = Boolean(options.quietHoursActive);
  const inside = runGit(["rev-parse", "--is-inside-work-tree"], cwd);

  if (!inside.ok || inside.stdout !== "true") {
    return createOutputStatusResult({
      checkedAt,
      quietHoursActive,
      reason: "not_a_git_repository"
    });
  }

  const root = runGit(["rev-parse", "--show-toplevel"], cwd);
  const branch = runGit(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd);
  const detachedHead = branch.ok ? null : runGit(["rev-parse", "--short", "HEAD"], cwd);
  const upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], cwd);
  const hasHead = runGit(["rev-parse", "--verify", "HEAD"], cwd).ok;
  const status = runGit(["status", "--porcelain=v1"], cwd);
  const hasLocalChanges = status.ok && status.stdout.length > 0;
  const localCommitCount = hasHead ? parseCount(runGit(["rev-list", "--count", "HEAD"], cwd).stdout) : 0;
  let aheadCount = 0;
  let behindCount = 0;
  let upstreamLatestCommitAt = null;
  let hasShippedToday = false;
  let hasUnpushedCommits = false;

  if (upstream.ok && upstream.stdout) {
    aheadCount = parseCount(runGit(["rev-list", "--count", `${upstream.stdout}..HEAD`], cwd).stdout);
    behindCount = parseCount(runGit(["rev-list", "--count", `HEAD..${upstream.stdout}`], cwd).stdout);
    hasUnpushedCommits = aheadCount > 0;

    const upstreamCommit = runGit(["log", "-1", "--format=%cI", upstream.stdout], cwd);
    upstreamLatestCommitAt = upstreamCommit.ok && upstreamCommit.stdout ? upstreamCommit.stdout : null;
    hasShippedToday = Boolean(upstreamLatestCommitAt && localDateKey(upstreamLatestCommitAt) === todayKey);
  } else {
    hasUnpushedCommits = localCommitCount > 0;
  }

  const classified = classifyOutputStatus({
    hasShippedToday,
    hasLocalChanges,
    hasUnpushedCommits,
    gitAvailable: true,
    quietHoursActive
  });

  return createOutputStatusResult({
    ...classified,
    checkedAt,
    hasLocalChanges,
    hasUnpushedCommits,
    hasShippedToday,
    quietHoursActive,
    repository: {
      available: true,
      root: root.ok ? root.stdout : null,
      branch: branch.ok ? branch.stdout : detachedHead.ok ? `detached:${detachedHead.stdout}` : null,
      upstream: upstream.ok ? upstream.stdout : null
    },
    details: {
      hasHead,
      aheadCount,
      behindCount,
      localCommitCount,
      upstreamLatestCommitAt,
      shippedDetectionSource: upstream.ok ? "git_upstream_commit_date_proxy" : "none",
      shippedDetectionLimitation: upstream.ok ? SHIPPED_DETECTION_LIMITATION : "No upstream branch is configured, so shipped-today evidence is unavailable in this phase."
    }
  });
}

module.exports = {
  OUTPUT_STATUSES,
  SHIPPED_DETECTION_LIMITATION,
  classifyOutputStatus,
  createOutputStatusResult,
  getGitOutputStatus
};
