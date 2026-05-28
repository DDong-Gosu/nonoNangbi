#!/usr/bin/env node
"use strict";

// Native messaging host (Phase G Spike 3).
// Chrome speaks the native-messaging protocol over stdio: each message is a
// little-endian uint32 length prefix followed by that many bytes of UTF-8 JSON.
// This host reads usage messages from the extension and appends them to a
// JSONL bridge file that Mongi can tail.

const fs = require("fs");
const os = require("os");
const path = require("path");

const OUT_DIR =
  process.env.MONGI_BRIDGE_OUT_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "Mongi", "spikes");
const OUT_FILE = path.join(OUT_DIR, "extension-bridge.jsonl");

function writeMessage(obj) {
  const buf = Buffer.from(JSON.stringify(obj), "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length, 0);
  process.stdout.write(len);
  process.stdout.write(buf);
}

function handle(msg) {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.appendFileSync(
      OUT_FILE,
      JSON.stringify({ receivedAt: new Date().toISOString(), ...msg }) + "\n"
    );
    writeMessage({ ok: true });
  } catch (e) {
    writeMessage({ ok: false, error: e.message });
  }
}

// stdin framing reader
let buf = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= 4) {
    const len = buf.readUInt32LE(0);
    if (buf.length < 4 + len) break;
    const body = buf.slice(4, 4 + len);
    buf = buf.slice(4 + len);
    try {
      handle(JSON.parse(body.toString("utf8")));
    } catch (_) {
      writeMessage({ ok: false, error: "bad json" });
    }
  }
});
process.stdin.on("end", () => process.exit(0));
