const db = require("../config/firebase");

async function createOrder(
  buyerId,
  productId,
  sellerId,
  deliveryInfo,
  createdAt,
  quantity
) {
  const orderId = db.ref("orders").push().key;
  await db.ref(`orders/${orderId}`).set({
    buyerId,
    productId,
    sellerId,
    deliveryInfo,
    status: "Pending",
    quantity,
    createdAt,
  });
  return orderId;
}

module.exports = { createOrder };
