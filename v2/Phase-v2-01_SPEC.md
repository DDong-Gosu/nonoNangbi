# Phase-v2-01 — Git Output Status Core

## Recommended file 1: `docs/phases/phase-v2-01_SPEC.md`

# Phase-v2-01_SPEC.md

## Phase-v2-01 — Git Output Status Core

## 0. Purpose

Phase-v2-01 establishes the core status model for Mongi V2.

Mongi V2 should move away from complex AI-session, usage-warning, and next-action based status logic.

The primary V2 product question is:

Did you ship today?

The core status model must be based on Git output signals.

Only three core statuses are allowed:

- NO_OUTPUT
- LOCAL_ONLY
- SHIPPED

AI usage can remain as secondary information, but it must not determine the core output status.

Quiet hours can remain as notification/UI context, but it must not become a core status.

This phase is foundational. Discord notifications, menu bar UI, refresh cadence, usage cards, and packaging should be built on top of this status model later.

---

## 1. Current problem

The current Mongi logic may include several mixed concepts:

- AI session state
- usage thresholds
- warning levels
- next action text
- quiet hours
- notification policy
- local app state
- actual Git output

This makes the product harder to reason about.

For V2, Mongi should use Git output as the primary signal.

The system should answer:

- Was something shipped today?
- Is there local work that has not shipped yet?
- Is there no Git output detected?

---

## 2. Core goal

Implement the V2 Git Output Status Core.

The final core status must be one of:

- NO_OUTPUT
- LOCAL_ONLY
- SHIPPED

The status must be determined from Git output signals, not AI usage or AI session activity.

---

## 3. Definitions

## 3.1 SHIPPED

SHIPPED means there is evidence that code was shipped today.

Preferred meaning:

- A commit was pushed to GitHub today.

Acceptable implementation for this phase:

- If an existing GitHub activity source exists, use it.
- If no GitHub activity source exists, use the remote/upstream Git branch as a proxy.
- If remote/upstream has a relevant commit from today, treat it as SHIPPED.

Important limitation:

Remote commit date is not always the same as GitHub push time. If the implementation uses commit date as a proxy for push activity, document that limitation in code comments, logs, or report.

---

## 3.2 LOCAL_ONLY

LOCAL_ONLY means there is local Git output, but no shipped evidence for today.

This includes:

- working tree changes
- staged changes
- untracked files
- local commits ahead of upstream
- local commits that appear unpushed
- no upstream exists but local commit/work exists

LOCAL_ONLY is the “you have work, but it has not shipped yet” state.

---

## 3.3 NO_OUTPUT

NO_OUTPUT means Mongi did not detect shipped output or local Git output.

This includes:

- no shipped evidence today
- no working tree changes
- no staged changes
- no untracked files
- no unpushed commits

NO_OUTPUT must not mean “the user did nothing.”

Use this meaning instead:

No shipped or local Git output detected.

---

## 4. Status priority

Use this priority order:

1. If shipped evidence exists today, status is SHIPPED.
2. Else if local changes or unpushed commits exist, status is LOCAL_ONLY.
3. Else status is NO_OUTPUT.

If shipped evidence exists and there are also local changes, core status should still be SHIPPED.

Local dirty/ahead information can be kept as details or modifiers, but it should not override SHIPPED.

---

## 5. Quiet hours rule

Quiet hours must not be a core status.

Do not add QUIET_HOURS as a fourth status.

Quiet hours should be represented as a modifier, detail, policy flag, or notification condition.

Quiet hours may affect:

- whether Discord notifications are sent
- notification intensity
- UI badge treatment
- status display details

Quiet hours must not affect:

- Git status detection
- output status classification
- whether the core status is NO_OUTPUT, LOCAL_ONLY, or SHIPPED

---

## 6. AI usage / session / next action rule

AI usage, AI session state, and next-action text must not determine the V2 core output status.

These may remain in the codebase as secondary signals for later phases.

Allowed:

- preserving usage parsers
- preserving usage percentages
- preserving state fields needed by existing commands
- preserving Discord infrastructure
- preserving monitor compatibility

Not allowed in the core output status path:

- classifying status from AI usage percentage
- classifying status from AI session activity
- classifying status from warning level
- classifying status from previous next action
- using token/session thresholds to decide NO_OUTPUT, LOCAL_ONLY, or SHIPPED

---

## 7. Git detection requirements

The implementation should inspect the current repository and reuse existing helpers if present.

At minimum, the status system should determine:

- whether the current directory is inside a Git repository
- repository root if available
- current branch if available
- whether the working tree has local changes
- whether local commits are ahead of upstream
- whether there is shipped evidence today
- final output status
- reason or details for the decision

If the current directory is not a Git repository, do not add UNKNOWN as a core status.

Keep the three-status model.

In that case, choose the safest compatible behavior for the existing app, but include a reason/detail such as not_a_git_repository.

---

## 8. Remote/GitHub shipped detection

Preferred order:

1. Use an existing GitHub activity source if the project already has one.
2. Use upstream/remote branch information as a proxy.
3. If neither is available, report the limitation and make the best conservative classification from local Git data.

Do not implement GitHub OAuth, GitHub App auth, external server infrastructure, or browser cookie/session extraction in this phase.

This phase is not about perfect GitHub event tracking. It is about establishing the V2 output status model.

---

## 9. State shape expectations

Do not unnecessarily break the existing state schema.

Add fields in a way that keeps existing monitor, health, and tests working.

The status result should make these things inspectable somewhere in state, logs, or returned data:

- outputStatus
- hasLocalChanges
- hasUnpushedCommits
- hasShippedToday or equivalent
- git repository availability
- branch if available
- upstream if available
- checkedAt
- reason or decision detail
- quietHours as modifier or detail if currently used

Use project naming conventions where possible.

Avoid large schema rewrites unless necessary.

---

## 10. Logging requirements

Logs should make the final decision understandable.

Include non-sensitive information such as:

- output status
- Git repo detection result
- branch
- upstream availability
- local changes result
- unpushed commit result
- shipped-today result
- quiet hours modifier
- failure reason if any

Do not log:

- Discord webhook URL
- .env values
- cookies
- session data
- access tokens
- private credentials

---

## 11. Tests and scenario requirements

Add or update tests/scenarios for these cases where practical:

1. NO_OUTPUT
   - clean working tree
   - no unpushed commits
   - no shipped evidence today

2. LOCAL_ONLY from dirty working tree
   - local file changes exist
   - no shipped evidence today

3. LOCAL_ONLY from unpushed commit
   - local commit ahead of upstream
   - no shipped evidence today

4. SHIPPED
   - shipped evidence exists today

5. Quiet hours modifier
   - quiet hours is true
   - output status remains NO_OUTPUT, LOCAL_ONLY, or SHIPPED
   - quiet hours does not replace the core status

If full integration tests are difficult, add unit tests for the status decision function and report what was not integration-tested.

---

## 12. Commands to run

The agent must not only edit code.

Run relevant commands and inspect the output.

Required commands if available:

- npm run test:state
- npm run test:scenarios
- npm run monitor
- npm run health

If any command does not exist:

- inspect package.json
- choose the closest available substitute
- run the substitute
- report the substitution

If a command fails:

- inspect the output
- fix if the failure is in scope
- rerun
- report remaining failures honestly

Do not say “should work” unless the behavior was actually executed or execution was impossible for a clear stated reason.

---

## 13. In scope

This phase includes:

- defining or refactoring the core output status model
- adding Git-based status checks
- wiring the output status into the monitor/state path
- separating quiet hours from core status
- removing AI usage/session/next-action from core status classification
- adding or updating status tests/scenarios
- preserving existing monitor and health command behavior

---

## 14. Out of scope

Do not work on:

- Discord message simplification
- Start button Discord message
- 3-line Discord notification templates
- exact percentage notification formatting
- refresh cadence UI
- popover refresh behavior
- short/weekly usage bars
- reset countdown UI
- Codex/Claude card redesign
- packaging scripts
- compile-and-run scripts
- TUI removal
- Browser cookie import
- OAuth/API migration
- GitHub OAuth
- GitHub App
- external server
- Chrome Extension
- Cloudflare bypass
- Turnstile bypass
- captcha bypass
- cookie extraction
- unauthorized session handling

---

## 15. Documentation update

A large documentation rewrite is not required in this phase.

However, if README, DESIGN, or current docs clearly describe an outdated status model, update them briefly.

The documentation should say:

- Mongi V2 uses Git output status as the primary status model.
- Core statuses are NO_OUTPUT, LOCAL_ONLY, and SHIPPED.
- AI usage is secondary.
- Quiet hours is a modifier, not a core status.

Do not spend this phase polishing all docs.

---

## 16. Success criteria

Phase-v2-01 is complete when:

1. The codebase has a clear V2 output status model.
2. Only NO_OUTPUT, LOCAL_ONLY, and SHIPPED are used as core output statuses.
3. Local Git dirty state is detected.
4. Unpushed local commits are detected or limitation is clearly handled.
5. Shipped-today evidence is detected through existing GitHub source or Git remote proxy.
6. Quiet hours is not a core status.
7. AI usage, session state, and next action do not determine the core output status.
8. Tests or scenarios cover the main status cases.
9. Relevant commands were run and inspected.
10. Any failed or unverified behavior is reported clearly.
11. No secrets or session data are printed.

---

## 17. Completion report format

At the end, report exactly:

Phase-v2-01 Report

1. Files created/changed
- ...

2. Core status model
- ...

3. Git checks implemented
- Working tree:
- Unpushed commits:
- Remote/GitHub today:
- Limitations:

4. Quiet hours handling
- ...

5. AI session / usage / next action changes
- ...

6. Tests / scenarios
- ...

7. Commands run
- ...

8. Output / log summary
- ...

9. Failed / Not verified
- ...

10. Next recommended phase
- Phase-v2-02 — Discord Notification Simplification

---

## 18. Final judgment

This phase is not mainly a feature addition.

It is a product model change.

Mongi V2 should stop asking:

How much AI did you use?

as the primary status question.

It should ask:

Did you ship today?

Everything else should be secondary.


---

## Recommended file 2: `docs/phases/phase-v2-01_AGENT_PROMPT.md`

# phase-v2-01_AGENT_PROMPT.md

You are an AI coding agent working on Mongi V2.

Your task is to implement Phase-v2-01.

Read these files first:

- AGENTS.md
- README.md
- DESIGN.md if present
- MVP_SPEC.md or current product spec if present
- docs/phases/phase-v2-01_SPEC.md

Also inspect the current Mongi architecture:

- monitor entrypoint
- state/status modules
- Git helper modules if present
- usage parser modules
- Discord message modules
- quiet hours logic
- scenario/state tests

## Mission

Implement the V2 Git Output Status Core.

Mongi V2 must classify the user's output status using only three core statuses:

- NO_OUTPUT
- LOCAL_ONLY
- SHIPPED

The main product question is:

Did you ship today?

AI usage, session state, and next-action text must not determine the core output status.

Quiet hours must be a modifier, not a core status.

## Required behavior

Follow docs/phases/phase-v2-01_SPEC.md.

Do not expand the scope beyond this phase.

Do not work on:

- Discord message simplification
- refresh cadence UI
- usage bars
- reset countdown UI
- app packaging
- TUI removal
- Browser cookie import
- OAuth/API migration

## Execution rule

Do not only write code.

For every meaningful task, complete this loop:

1. Implement
2. Run
3. Inspect logs/output
4. Fix if needed
5. Report changed files and commands run

Run the relevant commands from the spec.

If a required command does not exist, inspect package.json, choose the closest available alternative, and report the substitution.

Never report “should work” unless it was actually executed or execution was impossible for a clear reason.

## Security rules

Do not print or report:

- Discord Webhook URL
- .env contents
- cookies/session data
- access tokens
- private credentials

Do not implement or suggest:

- Cloudflare bypass
- Turnstile bypass
- captcha bypass
- cookie extraction
- unauthorized session handling

## Completion report

At the end, report exactly:

Phase-v2-01 Report

1. Files created/changed
- ...

2. Core status model
- ...

3. Git checks implemented
- Working tree:
- Unpushed commits:
- Remote/GitHub today:
- Limitations:

4. Quiet hours handling
- ...

5. AI session / usage / next action changes
- ...

6. Tests / scenarios
- ...

7. Commands run
- ...

8. Output / log summary
- ...

9. Failed / Not verified
- ...

10. Next recommended phase
- Phase-v2-02 — Discord Notification Simplification