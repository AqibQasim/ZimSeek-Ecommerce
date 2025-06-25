const readline = require("readline");
const {
  addProduct,
  getProductsByCategory,
  getProductsByName,
} = require("../models/product");
const { createInquiry } = require("../models/inquiry");
const { createOrder } = require("../models/order");
const { preprocessQuery } = require("../utils/queryProcessor");
const db = require("../config/firebase");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (question) =>
  new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });

async function handleProductFlow(sellerId) {
  await addProductInteractively(sellerId);
}

async function addProductInteractively(sellerId) {
  let validInput = false;
  while (!validInput) {
    const input = await prompt(
      "Enter product details (ADD PRODUCT | NAME | CATEGORY | CITY | PRICE | UNIT): "
    );
    const [command, name, category, city, price, unit] = input
      .split(" | ")
      .map((item) => item.trim());

    if (
      command &&
      command.toUpperCase() === "ADD PRODUCT" &&
      name &&
      category &&
      city &&
      price &&
      unit
    ) {
      validInput = true;
      await addProduct(sellerId, name, category, city, price, unit);
      console.log(`Product ${name} added successfully!`);
    } else {
      console.log(
        "Invalid format. Example: ADD PRODUCT | Football | Other | Kadoma | 10 | per piece"
      );
    }
  }

  const addAnother = await prompt("Add another product? (yes/no): ");
  if (addAnother.toLowerCase() === "yes") {
    await addProductInteractively(sellerId);
  } else {
    rl.close();
    require("./authController").startApp();
  }
}

async function handleBuyerQuery(buyerId) {
  const query = await prompt(
    'Enter your query (e.g., "How much is the iPhone?" or "SeaFood"): '
  );
  await createInquiry(buyerId, query);

  const queryText = preprocessQuery(query).toLowerCase(); // Normalize to lowercase
  let response = "Here are the results:\n";
  let matchedProducts = [];

  const productsByCategory = await getProductsByCategory(queryText);
  if (productsByCategory.length > 0) {
    matchedProducts = productsByCategory;
    response = `Products in category ${matchedProducts[0].category}:\n`;
  } else {
    matchedProducts = await getProductsByName(queryText);
  }

  if (matchedProducts.length === 0) {
    response = `No products or categories found matching your query. Available categories: ${await getAvailableCategories()}.`;
    console.log(response);
  } else {
    for (const product of matchedProducts) {
      const sellerSnapshot = await db
        .ref(`sellers/${product.sellerId}`)
        .once("value");
      const seller = sellerSnapshot.val();
      if (seller) {
        response += `${product.name} at ${seller.storeName}: $${product.price} ${product.unit}\n`;
      } else {
        console.log(
          `Warning: No seller found for product ${product.name} (ID: ${product.productId})`
        );
      }
    }
    console.log(response);
  }

  if (matchedProducts.length > 0) {
    const purchase = await prompt(
      "Do you want to purchase a product? (yes/no): "
    );
    if (purchase.toLowerCase() === "yes") {
      const storeName = await prompt("Enter the store name to purchase from: ");
      let selectedProduct;
      for (const p of matchedProducts) {
        const seller = await db
          .ref(`sellers/${p.sellerId}`)
          .once("value")
          .then((s) => s.val());
        if (
          seller &&
          seller.storeName.toLowerCase() === storeName.toLowerCase()
        ) {
          selectedProduct = p;
          break;
        }
      }

      if (selectedProduct) {
        const deliveryInfo = await prompt("Enter delivery address: ");
        const orderId = await createOrder(
          buyerId,
          selectedProduct.productId,
          selectedProduct.sellerId,
          deliveryInfo
        );
        console.log(`Order placed successfully! Order ID: ${orderId}`);
      } else {
        console.log("Invalid store name. Returning to main menu.");
      }
    }
  }

  const anotherQuery = await prompt("Make another query? (yes/no): ");
  if (anotherQuery.toLowerCase() === "yes") {
    await handleBuyerQuery(buyerId);
  } else {
    rl.close();
    require("./authController").startApp();
  }
}

async function getAvailableCategories() {
  const snapshot = await db.ref("products").once("value");
  const products = snapshot.val();
  return products
    ? [
        ...new Set(
          Object.values(products).map((p) => p.category.toLowerCase())
        ),
      ].join(", ")
    : "";
}

module.exports = { handleProductFlow, handleBuyerQuery };
