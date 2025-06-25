function preprocessQuery(query) {
  // Extract potential product name, ignoring "how much is the" or similar phrases
  const words = query.toLowerCase().split(/\s+/);
  const productName =
    words.find((word) => word.match(/^[a-zA-Z]+$/)) || words.pop() || query;
  return productName.trim();
}

module.exports = { preprocessQuery };
