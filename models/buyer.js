const db = require("../config/firebase");

async function registerBuyer(name, phone, timestamp) {
  const newBuyerRef = db.ref("buyers").push();
  await newBuyerRef.set({
    name: name.toLowerCase(),
    phone: phone,
    createdAt: timestamp,
  });
  return newBuyerRef.key;
}

async function getBuyerByPhone(phone) {
  const snapshot = await db
    .ref("buyers")
    .orderByChild("phone")
    .equalTo(phone)
    .once("value");
  const buyers = snapshot.val();
  return buyers ? Object.keys(buyers)[0] : null;
}

module.exports = { registerBuyer, getBuyerByPhone };
