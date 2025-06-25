const db = require("../config/firebase");
const admin = require("firebase-admin"); // Added import

async function createInquiry(buyerId, message) {
  const inquiryId = db.ref("inquiries").push().key;
  await db.ref(`inquiries/${inquiryId}`).set({
    buyerId,
    productId: null,
    timestamp: admin.database.ServerValue.TIMESTAMP, // Updated to use admin
    location: "Manhattan",
    message,
  });
  return inquiryId;
}

module.exports = { createInquiry };
