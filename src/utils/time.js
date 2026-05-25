function nowIso() {
  return new Date().toISOString();
}

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

module.exports = {
  nowIso,
  timestampForFilename
};
