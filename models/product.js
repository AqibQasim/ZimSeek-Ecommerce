const db = require("../config/firebase");

async function addProduct(
  sellerId,
  name,
  category,
  city,
  price,
  suburb,
  createdAt
) {
  const normalizedCategory = category.toLowerCase();
  const productId = db.ref("products").push().key;
  await db.ref(`products/${productId}`).set({
    name,
    category: normalizedCategory,
    city,
    price,
    sellerId,
    suburb,
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
          ([_, p]) => {
            const productName = p.name.toLowerCase();
            const searchText = queryText.toLowerCase();
            
            // Exact match
            if (productName === searchText) return true;
            
            // Partial match - search text contains product name
            if (productName.includes(searchText)) return true;
            
            // Partial match - product name contains search text
            if (searchText.includes(productName)) return true;
            
            // Fuzzy match for plurals/singulars (e.g., chilli/chillies)
            const productWords = productName.split(/\s+/);
            const searchWords = searchText.split(/\s+/);
            
            for (const searchWord of searchWords) {
              for (const productWord of productWords) {
                // Check if one word is contained in the other (handles plurals)
                if (productWord.includes(searchWord) || searchWord.includes(productWord)) {
                  return true;
                }
                
                // Check for common plural/singular patterns
                if (
                  (productWord.endsWith('ies') && searchWord === productWord.slice(0, -3) + 'y') ||
                  (searchWord.endsWith('ies') && productWord === searchWord.slice(0, -3) + 'y') ||
                  (productWord.endsWith('s') && searchWord === productWord.slice(0, -1)) ||
                  (searchWord.endsWith('s') && productWord === searchWord.slice(0, -1))
                ) {
                  return true;
                }
              }
            }
            
            return false;
          }
        )
        .map(([productId, p]) => ({ productId, ...p }))
    : [];
}

module.exports = { addProduct, getProductsByCategory, getProductsByName };
