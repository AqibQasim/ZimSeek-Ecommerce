const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const { registerSeller, getSellerByEmail } = require("../models/seller");
const { registerBuyer, getBuyerByPhone } = require("../models/buyer");
const { createInquiry } = require("../models/inquiry");
const { createOrder } = require("../models/order");
const {
  addProduct,
  getProductsByCategory,
  getProductsByName,
} = require("../models/product");

require("dotenv").config();

const db = require("../config/firebase");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = new twilio(accountSid, authToken);

let currentState = {};
const states = {
  START: "start",
  BUYER_SELLER: "buyer_seller",
  REGISTRATION: "registration",
  REGISTRATION_NAME: "registration_name",
  REGISTRATION_STORE: "registration_store",
  REGISTRATION_EMAIL: "registration_email",
  REGISTRATION_PHONE: "registration_phone",
  REGISTRATION_BUSINESS: "registration_business",
  REGISTRATION_CITY: "registration_city",
  REGISTRATION_SUBURB: "registration_suburb",
  SELLER_ADD_PRODUCT: "seller_add_product",
  BUYER_QUERY: "buyer_query",
  BUYER_PURCHASE: "buyer_purchase",
};

router.post("/message", async (req, res) => {
  console.log("Received message:", req.body.Body, "from:", req.body.From);
  const incomingMsg = req.body.Body ? req.body.Body.toLowerCase().trim() : "";
  const from = req.body.From || "whatsapp:+14155238886";
  let message = "";

  if (!currentState[from])
    currentState[from] = { state: states.START, data: {} };

  switch (currentState[from].state) {
    case states.START:
      message =
        "Hello, welcome to Zimseek! Are you a buyer or seller? (buyer/seller)";
      currentState[from].state = states.BUYER_SELLER;
      break;
    case states.BUYER_SELLER:
      if (incomingMsg === "buyer" || incomingMsg === "seller") {
        currentState[from].data.userType = incomingMsg;
        message = `Are you already registered? (yes/no)`;
        currentState[from].state = states.REGISTRATION;
      } else {
        message = 'Invalid choice. Please type "buyer" or "seller".';
      }
      break;
    case states.REGISTRATION:
      if (incomingMsg === "yes" || incomingMsg === "no") {
        currentState[from].data.hasAccount = incomingMsg;
        if (incomingMsg === "yes") {
          if (currentState[from].data.userType === "seller") {
            message = "Enter your email:";
            currentState[from].state = states.REGISTRATION_EMAIL;
          } else {
            message = "Enter your phone number:";
            currentState[from].state = states.REGISTRATION_PHONE;
          }
        } else {
          message = "Enter your name:";
          currentState[from].state = states.REGISTRATION_NAME;
        }
      } else {
        message = 'Please type "yes" or "no".';
      }
      break;
    case states.REGISTRATION_NAME:
      currentState[from].data.name = incomingMsg;
      if (currentState[from].data.userType === "seller") {
        message = "Enter your store name:";
        currentState[from].state = states.REGISTRATION_STORE;
      } else {
        message = "Enter your phone number:";
        currentState[from].state = states.REGISTRATION_PHONE;
      }
      break;
    case states.REGISTRATION_STORE:
      currentState[from].data.storeName = incomingMsg;
      message = "Enter your email:";
      currentState[from].state = states.REGISTRATION_EMAIL;
      break;
    case states.REGISTRATION_EMAIL:
      currentState[from].data.email = incomingMsg;
      if (currentState[from].data.hasAccount === "yes") {
        const sellerId = await getSellerByEmail(incomingMsg);
        if (sellerId) {
          const seller = (
            await db.ref(`sellers/${sellerId}`).once("value")
          ).val();
          currentState[from].data.sellerId = sellerId;

          message = `Welcome back, ${seller.sellerName}! \n Type "add product" to add a new product.`;
          currentState[from].state =
            currentState[from].data.userType === "seller"
              ? states.SELLER_ADD_PRODUCT
              : states.BUYER_QUERY;
        } else {
          message = 'No account found. Please register with "no".';
          currentState[from].state = states.REGISTRATION;
        }
      } else {
        message = "Enter your phone number:";
        currentState[from].state = states.REGISTRATION_PHONE;
      }
      break;
    case states.REGISTRATION_PHONE:
      currentState[from].data.phone = incomingMsg;
      if (currentState[from].data.hasAccount === "yes") {
        const buyerId = await getBuyerByPhone(incomingMsg);
        if (buyerId) {
          const buyer = (await db.ref(`buyers/${buyerId}`).once("value")).val();
          currentState[from].data.buyerId = buyerId;

          message = `Welcome back, ${buyer.name}! \n Feel free to explore our products by asking, for example, "what's the price of chicken" or "show me grains"`;
          currentState[from].state = states.BUYER_QUERY;
        } else {
          message = 'No account found. Please register with "no".';
          currentState[from].state = states.REGISTRATION;
        }
      } else {
        if (currentState[from].data.userType === "seller") {
          message = "Enter your business type (e.g., Cooperative, Retail):";
          currentState[from].state = states.REGISTRATION_BUSINESS;
        } else {
          const buyerId = await registerBuyer(
            currentState[from].data.name,
            incomingMsg
          );
          message = `Welcome, ${currentState[from].data.name}! \n Feel free to explore our products by asking, for example, "what's the price of chicken" or "show me grains"`;
          currentState[from].state = states.BUYER_QUERY;
        }
      }
      break;
    case states.REGISTRATION_BUSINESS:
      currentState[from].data.businessType = incomingMsg;
      message = "Enter your city:";
      currentState[from].state = states.REGISTRATION_CITY;
      break;
    case states.REGISTRATION_CITY:
      currentState[from].data.city = incomingMsg;
      message = "Enter your suburb:";
      currentState[from].state = states.REGISTRATION_SUBURB;
      break;
    case states.REGISTRATION_SUBURB:
      currentState[from].data.suburb = incomingMsg;
      const sellerId = await registerSeller(
        currentState[from].data.name,
        currentState[from].data.storeName,
        currentState[from].data.email,
        currentState[from].data.phone,
        currentState[from].data.businessType,
        currentState[from].data.city,
        currentState[from].data.suburb
      );
      currentState[from].data.sellerId = sellerId;
      message = `Welcome, ${currentState[from].data.name}! \n Type "add product" to add a new product.`;
      currentState[from].state = states.SELLER_ADD_PRODUCT;
      break;
    case states.SELLER_ADD_PRODUCT:
      if (incomingMsg.toLowerCase() === "add product") {
        message =
          "Enter product details (NAME | CATEGORY | CITY | PRICE | UNIT):";
        currentState[from].state = "seller_add_product_details";
      } else {
        message = 'Type "add product" to add a new product.';
      }
      break;
    case "seller_add_product_details":
      const [name, category, city, price, unit] = incomingMsg
        .split("|")
        .map((item) => item.trim());
      if (name && category && city && price && unit) {
        await addProduct(
          currentState[from].data.sellerId,
          name,
          category,
          city,
          price,
          unit
        );
        message = `Product ${name} added successfully! Type "add product" to add more or "done".`;
        currentState[from].state = states.SELLER_ADD_PRODUCT;
      } else {
        message = "Invalid format. Use: NAME | CATEGORY | CITY | PRICE | UNIT";
      }
      break;
    case states.BUYER_QUERY:
      const queryWords = incomingMsg.split(/\s+/);
      let queryType = queryWords[0];
      let queryValue = queryWords.slice(1).join(" ").toLowerCase();
      let products = [];

      if (
        queryType === "how" ||
        queryType === "what" ||
        queryType === "price"
      ) {
        products =
          (await getProductsByName(queryValue)) ||
          (await getProductsByCategory(queryValue));
      } else {
        products =
          (await getProductsByName(incomingMsg)) ||
          (await getProductsByCategory(incomingMsg));
      }

      if (products.length > 0) {
        message = "Available products:\n";
        for (const product of products) {
          const snapshot = await db
            .ref(`sellers/${product.sellerId}`)
            .once("value");
          const seller = snapshot.val();
          if (seller) {
            message += `${product.name} - ${seller.storeName}: $${product.price} ${product.unit} (City: ${product.city})\n`;
          }
        }
        // Save buyer inquiry
        await createInquiry(
          currentState[from].data.buyerId,
          incomingMsg,
          new Date().toISOString()
        );
        currentState[from].data.products = products; // Store products for later use
        message += "\nWould you like to purchase? (yes/no) or query again.";
        currentState[from].state = states.BUYER_PURCHASE;
      } else {
        message =
          'No products found. Try another query (e.g., "chicken" or "grains").';
      }
      break;
    case states.BUYER_PURCHASE:
      if (incomingMsg.toLowerCase() === "yes") {
        message = "Enter the store name to purchase from:";
        currentState[from].state = "buyer_select_store";
      } else {
        message = 'Type "yes" to purchase or query again.';
        currentState[from].state = states.BUYER_QUERY;
      }
      break;
    case "buyer_select_store":
      currentState[from].data.storeName = incomingMsg;
      message = "Enter delivery address:";
      currentState[from].state = "buyer_delivery";
      break;
    case "buyer_delivery":
      currentState[from].data.deliveryAddress = incomingMsg;
      // Find selected product asynchronously
      let selectedProduct = null;
      for (const product of currentState[from].data.products) {
        const snapshot = await db
          .ref(`sellers/${product.sellerId}`)
          .once("value");
        const seller = snapshot.val();
        if (seller && seller.storeName === currentState[from].data.storeName) {
          selectedProduct = product;
          break;
        }
      }
      if (selectedProduct) {
        await createOrder(
          currentState[from].data.buyerId,
          selectedProduct.productId,
          selectedProduct.sellerId,
          currentState[from].data.deliveryAddress,
          new Date().toISOString()
        );
        message = `Purchase successful! Order placed! (ID: ${selectedProduct.productId})`;
      } else {
        message = "No matching product found for the selected store.";
      }
      currentState[from].state = states.BUYER_QUERY;
      break;
    default:
      message = "Invalid state. Restarting...";
      currentState[from].state = states.START;
  }

  try {
    await client.messages.create({
      body: message,
      from: "whatsapp:+14155238886",
      to: from,
    });
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end();
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).send("Error processing request");
  }
});

module.exports = router;
