const db = require("../config/firebase");

async function createOrder(buyerId, productId, sellerId, deliveryInfo) {
  const orderId = db.ref("orders").push().key;
  await db.ref(`orders/${orderId}`).set({
    buyerId,
    productId,
    sellerId,
    deliveryInfo,
    status: "Pending",
  });
  return orderId;
}

module.exports = { createOrder };
