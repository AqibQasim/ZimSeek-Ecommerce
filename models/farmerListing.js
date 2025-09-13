const db = require("../config/firebase");

async function addFarmerListing(
  farmerId,
  productName,
  category,
  price,
  city,
  suburb,
  createdAt
) {
  const listingId = db.ref("farmerListings").push().key;
  await db.ref(`farmerListings/${listingId}`).set({
    listingId,
    farmerId,
    productName,
    category,
    price,
    city,
    suburb,
    createdAt,
  });
  return listingId;
}

module.exports = {
  addFarmerListing,
};
