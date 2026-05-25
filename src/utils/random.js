function pickRandom(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("pickRandom requires a non-empty array.");
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

module.exports = {
  pickRandom
};
