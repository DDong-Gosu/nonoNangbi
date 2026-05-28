#!/usr/bin/env node
"use strict";

// Phase G Spike 1 receiver.
// Claude Code invokes the configured statusLine command on every TUI render,
// passing a JSON payload on stdin. This receiver:
//   1. reads the stdin JSON
//   2. redacts anything path/secret-like
//   3. appends a normalized record to a JSONL file
//   4. prints a one-line status string back to stdout (so the TUI shows it)
//
// It is intentionally dependency-free and never writes tokens/paths verbatim.

const fs = require("fs");
const os = require("os");
const path = require("path");

const OUT_DIR =
  process.env.MONGI_STATUSLINE_OUT_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "Mongi", "spikes");
const OUT_FILE = path.join(OUT_DIR, "claude-statusline.jsonl");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch (_) {
    return "";
  }
}

// Replace absolute home paths with ~ and truncate long ids so nothing
// sensitive is persisted.
function redactString(s) {
  if (typeof s !== "string") return s;
  const home = os.homedir();
  let out = s.split(home).join("~");
  return out;
}

function shortId(id) {
  if (typeof id !== "string" || id.length <= 8) return id;
  return id.slice(0, 8) + "…";
}

function pick(obj, keyPath) {
  return keyPath.reduce(
    (acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined),
    obj
  );
}

function main() {
  const raw = readStdin();
  let data = null;
  let parseError = null;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    parseError = e.message;
  }

  const now = new Date().toISOString();

  // Normalized extraction of every field Mongi might care about.
  const normalized = {
    receivedAt: now,
    parseOk: !parseError,
    parseError,
    topLevelKeys: data && typeof data === "object" ? Object.keys(data) : [],
    model: pick(data || {}, ["model", "display_name"]) ||
      pick(data || {}, ["model", "id"]) ||
      null,
    sessionId: shortId(pick(data || {}, ["session_id"])),
    version: pick(data || {}, ["version"]) || null,
    outputStyle: pick(data || {}, ["output_style", "name"]) || null,
    workspaceDir: redactString(
      pick(data || {}, ["workspace", "current_dir"]) ||
        pick(data || {}, ["cwd"]) ||
        ""
    ),
    cost: {
      totalCostUsd: pick(data || {}, ["cost", "total_cost_usd"]) ?? null,
      totalDurationMs: pick(data || {}, ["cost", "total_duration_ms"]) ?? null,
      totalLinesAdded: pick(data || {}, ["cost", "total_lines_added"]) ?? null,
      totalLinesRemoved:
        pick(data || {}, ["cost", "total_lines_removed"]) ?? null,
    },
    // Confirmed statusLine schema (from Claude Code 2.1.153 embedded types).
    // Recorded as null if absent so the spike proves presence/absence.
    contextWindow: {
      exceeds200k: pick(data || {}, ["exceeds_200k_tokens"]) ?? null,
      size: pick(data || {}, ["context_window", "context_window_size"]) ?? null,
      currentUsage: pick(data || {}, ["context_window", "current_usage"]) ?? null,
      usedPercentage:
        pick(data || {}, ["context_window", "used_percentage"]) ?? null,
      remainingPercentage:
        pick(data || {}, ["context_window", "remaining_percentage"]) ?? null,
    },
    // "subscription usage limits. Only present for subscribers after first
    // API response" — so these are null on a fresh/idle session.
    rateLimits: {
      present: !!pick(data || {}, ["rate_limits"]),
      fiveHourUsedPct:
        pick(data || {}, ["rate_limits", "five_hour", "used_percentage"]) ?? null,
      fiveHourResetsAt:
        pick(data || {}, ["rate_limits", "five_hour", "resets_at"]) ?? null,
      weeklyUsedPct:
        pick(data || {}, ["rate_limits", "seven_day", "used_percentage"]) ?? null,
      weeklyResetsAt:
        pick(data || {}, ["rate_limits", "seven_day", "resets_at"]) ?? null,
      rawRateLimitKeys:
        data && data.rate_limits && typeof data.rate_limits === "object"
          ? Object.keys(data.rate_limits)
          : [],
    },
  };

  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.appendFileSync(OUT_FILE, JSON.stringify(normalized) + "\n");
  } catch (_) {
    // never block the TUI on a write failure
  }

  // status line text printed back to Claude Code's TUI
  const model = normalized.model || "claude";
  const ctx = normalized.contextWindow.exceeds200k === true ? " ⚠ctx" : "";
  process.stdout.write(`mongi-spike ${model}${ctx}`);
}

main();
