const db = require("../config/firebase");

async function registerSeller(
  sellerName,
  storeName,
  email,
  phone,
  businessType,
  city,
  suburb,
  createdAt
) {
  const sellerId = db.ref("sellers").push().key;
  await db.ref(`sellers/${sellerId}`).set({
    sellerName,
    storeName,
    email,
    phone,
    businessType,
    location: { city, suburb },
    createdAt,
  });
  return sellerId;
}

async function getSellerByEmail(email) {
  const snapshot = await db
    .ref("sellers")
    .orderByChild("email")
    .equalTo(email)
    .once("value");
  const sellers = snapshot.val();
  return sellers ? Object.keys(sellers)[0] : null;
}

async function getSellerByPhone(phone) {
  const snapshot = await db
    .ref("sellers")
    .orderByChild("phone")
    .equalTo(phone)
    .once("value");
  const sellers = snapshot.val();
  return sellers ? Object.keys(sellers)[0] : null;
}

module.exports = { registerSeller, getSellerByEmail, getSellerByPhone };
