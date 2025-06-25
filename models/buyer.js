const db = require("../config/firebase");

async function registerBuyer(name, phone) {
  const buyerId = db.ref("buyers").push().key;
  await db.ref(`buyers/${buyerId}`).set({ name, phone });
  return buyerId;
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
