const db = require("../config/firebase");

async function addProduct(
  sellerId,
  name,
  category,
  city,
  price,
  unit,
  createdAt
) {
  const normalizedCategory = category
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const productId = db.ref("products").push().key;
  await db.ref(`products/${productId}`).set({
    name,
    category: normalizedCategory,
    city,
    price: parseFloat(price),
    unit,
    sellerId,
    createdAt,
  });
  return productId;
}

async function getProductsByCategory(category) {
  const snapshot = await db.ref("products").once("value");
  const products = snapshot.val();
  return products
    ? Object.entries(products)
        .filter(([_, p]) => p.category.toLowerCase() === category.toLowerCase())
        .map(([productId, p]) => ({ productId, ...p }))
    : [];
}

async function getProductsByName(queryText) {
  const snapshot = await db.ref("products").once("value");
  const products = snapshot.val();
  return products
    ? Object.entries(products)
        .filter(
          ([_, p]) =>
            p.name.toLowerCase().includes(queryText) ||
            queryText.includes(p.name.toLowerCase())
        )
        .map(([productId, p]) => ({ productId, ...p }))
    : [];
}

module.exports = { addProduct, getProductsByCategory, getProductsByName };
