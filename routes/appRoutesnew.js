const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const db = require("../config/firebase");
const { registerSeller } = require("../models/seller");
const { addProduct } = require("../models/product");
const { addFarmerListing } = require("../models/farmerListing");
const twilio = require("twilio");
const { registerBuyer } = require("../models/buyer.js");

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GODADDY_EMAIL,
    pass: process.env.GODADDY_PASSWORD,
  },
});

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

let currentState = {};

// Normalize restart prompt across all responses
function normalizeRestartPrompt(text) {
  let normalized = String(text || "");
  normalized = normalized.replace(
    /Type 0 to back to [^\n]+/gi,
    "Type 0 to end the conversation"
  );
  normalized = normalized.replace(
    /Type 0 to back [^\n]*/gi,
    "Type 0 to end the conversation"
  );
  if (!/Type 0 to end the conversation/i.test(normalized)) {
    normalized = `${normalized}\n\nType 0 to end the conversation`;
  }
  return normalized;
}

const states = {
  START: "start",
  REG_CHOICE: "reg_choice",
  REG_ALREADY: "reg_already",
  REG_NAME: "reg_name",
  REG_STORE: "reg_store",
  REG_PHONE: "reg_phone",
  REG_EMAIL: "reg_email",
  REG_CITY: "reg_city",
  REG_SUBURB: "reg_suburb",
  REG_CONFIRM: "reg_confirm",
  MENU: "menu",
  ADD_CATEGORY: "add_category",
  ADD_NAME: "add_name",
  ADD_PRICE: "add_price",
  ADD_LOCATION: "add_location",
  ADD_SUBURB: "add_suburb",
  ADD_CONFIRM: "add_confirm",
  SELLER_TYPE: "seller_type",
  FARMER_REG_ALREADY: "farmer_reg_already",
  FARMER_REG_NAME: "farmer_reg_name",
  FARMER_REG_EMAIL: "farmer_reg_email",
  FARMER_REG_FARM: "farmer_reg_farm",
  FARMER_REG_PHONE: "farmer_reg_phone",
  FARMER_REG_CITY: "farmer_reg_city",
  FARMER_REG_SUBURB: "farmer_reg_suburb",
  FARMER_REG_CONFIRM: "farmer_reg_confirm",
  FARMER_MENU: "farmer_menu",
  FARMER_ADD_CATEGORY: "farmer_add_category",
  FARMER_ADD_SUBPRODUCT: "farmer_add_subproduct",
  FARMER_ADD_QUANTITY: "farmer_add_quantity",
  FARMER_ADD_PRICE: "farmer_add_price",
  FARMER_ADD_LOCATION: "farmer_add_location",
  FARMER_ADD_SUBURB: "farmer_add_suburb",
  FARMER_ADD_CONFIRM: "farmer_add_confirm",
  EDIT_PRODUCT: "edit_product",
  SELECT_PRODUCT: "select_product",
  EDIT_FIELD: "edit_field",
  EDIT_CONFIRM: "edit_confirm",
  FARMER_EDIT_LISTING: "farmer_edit_listing",
  FARMER_SELECT_LISTING: "farmer_select_listing",
  FARMER_EDIT_FIELD: "farmer_edit_field",
  FARMER_EDIT_CONFIRM: "farmer_edit_confirm",
  ADD_NAME_CUSTOM: "add_name_custom",
  FARMER_ADD_SUBPRODUCT_CUSTOM: "farmer_add_subproduct_custom",
  BUYER_REG_ALREADY: "buyer_reg_already",
  BUYER_REG_NAME: "buyer_reg_name",
  BUYER_REG_PHONE: "buyer_reg_phone",
  BUYER_BUSINESS_TYPE: "buyer_business_type",
  BUYER_MENU: "buyer_menu",
  BUYER_SEARCH_CATEGORY: "buyer_search_category",
  BUYER_SEARCH_PRODUCT: "buyer_search_product",
  BUYER_SEARCH_LOCATION: "buyer_search_location",
  BUYER_SEARCH_RESULTS: "buyer_search_results",
  BUYER_CONNECT_SELLER: "buyer_connect_seller",
  BUYER_SEARCH_TYPE: "buyer_search_type",
  BUYER_SEARCH_PRODUCT_CUSTOM: "buyer_search_product_custom",
};

const categories = [
  "Groceries and Household",
  "Cosmetics and Personal Care",
  "Vegetables and Produce",
  "Snacks and Convenience Foods",
  "Clothing (New or Secondhand)",
  "Electronics and Gadgets",
  "Medicines and Health Items",
  "Cleaning and Hardware",
  "Toiletries and Hygiene",
  "Cooling Items (Ice Packs)",
];

const farmerCategories = [
  "Grains and Cereals",
  "Legumes and Pulses",
  "Fresh Produce",
  "Livestock and Animal Products",
  "Cash Crops",
  "Other Farm Products",
];

const farmerSubProducts = {
  "Grains and Cereals": [
    "Maize",
    "Rice",
    "Wheat",
    "Sorghum",
    "Millet",
    "Other",
  ],
  "Legumes and Pulses": [
    "Beans",
    "Lentils",
    "Peas",
    "Groundnuts",
    "Cowpeas",
    "Other",
  ],
  "Fresh Produce": [
    "Tomatoes",
    "Onions",
    "Cabbage",
    "Leafy Greens (rape/covo)",
    "Carrots",
    "Potatoes",
    "Sweet Potatoes",
    "Butternuts / Pumpkin",
    "Fruits (Bananas/Mango/Avocado/Guava/Pawpaw)",
    "Other",
  ],
  "Livestock and Animal Products": [
    "Eggs",
    "Milk",
    "Chicken",
    "Beef",
    "Goat Meat",
    "Other",
  ],
  "Cash Crops": ["Cotton", "Tobacco", "Coffee", "Tea", "Sugar Cane", "Other"],
  "Other Farm Products": ["Honey", "Fertilizer", "Seeds", "Wood", "Other"],
};

const retailerSubProducts = {
  "Groceries and Household": [
    "Rice",
    "Sugar",
    "Flour",
    "Cooking Oil",
    "Salt",
    "Other",
  ],
  "Cosmetics and Personal Care": [
    "Shampoo",
    "Soap",
    "Lotion",
    "Toothpaste",
    "Deodorant",
    "Other",
  ],
  "Vegetables and Produce": [
    "Tomatoes",
    "Onions",
    "Carrots",
    "Cabbage",
    "Potatoes",
    "Other",
  ],
  "Snacks and Convenience Foods": [
    "Chips",
    "Biscuits",
    "Candy",
    "Bread",
    "Peanuts",
    "Other",
  ],
  "Clothing (New or Secondhand)": [
    "T-Shirts",
    "Jeans",
    "Dresses",
    "Shoes",
    "Jackets",
    "Other",
  ],
  "Electronics and Gadgets": [
    "Phone Chargers",
    "Headphones",
    "Power Banks",
    "LED Bulbs",
    "Radios",
    "Other",
  ],
  "Medicines and Health Items": [
    "Painkillers",
    "Bandages",
    "Vitamins",
    "Cough Syrup",
    "Antiseptic",
    "Other",
  ],
  "Cleaning and Hardware": [
    "Brooms",
    "Detergent",
    "Nails",
    "Hammers",
    "Paint",
    "Other",
  ],
  "Toiletries and Hygiene": [
    "Toilet Paper",
    "Sanitary Pads",
    "Razors",
    "Towels",
    "Handwash",
    "Other",
  ],
  "Cooling Items (Ice Packs)": [
    "Ice Packs",
    "Cool Boxes",
    "Ice Trays",
    "Cooler Bags",
    "Other",
  ],
};

const zimbabweCities = [
  "Harare",
  "Bulawayo",
  "Chitungwiza",
  "Mutare",
  "Gweru",
  "Epworth",
  "Kwekwe",
  "Kadoma",
  "Masvingo",
  "Chinhoyi",
  "Norton",
  "Marondera",
  "Bindura",
  "Zvishavane",
  "Beitbridge",
  "Victoria Falls",
  "Hwange",
  "Rusape",
  "Kariba",
  "Gokwe",
];

// Helper to send email safely
function safeSendMail(mailOptions) {
  transporter
    .sendMail(mailOptions)
    .catch((err) => console.error("Failed to send email:", err));
}

// Helper to fetch retailer products
async function fetchRetailerProducts(sellerId) {
  const productsSnap = await db
    .ref("products")
    .orderByChild("sellerId")
    .equalTo(sellerId)
    .once("value");
  return productsSnap.val();
}

// Helper to fetch farmer listings
async function fetchFarmerListings(sellerId) {
  const listingsSnap = await db
    .ref("farmerListings")
    .orderByChild("farmerId")
    .equalTo(sellerId)
    .once("value");
  return listingsSnap.val();
}

// Helper to update retailer product
async function updateRetailerProduct(productId, updates) {
  await db.ref(`products/${productId}`).update(updates);
}

// Helper to update farmer listing
async function updateFarmerListing(listingId, updates) {
  await db.ref(`farmerListings/${listingId}`).update(updates);
}

router.post("/message", async (req, res) => {
  console.log("Received message:", req.body.Body, "from:", req.body.From);
  const incomingMsg = req.body.Body ? req.body.Body.trim() : "";
  const from = req.body.From || "whatsapp:+12183048034";
  let message = "";

  if (!currentState[from])
    currentState[from] = { state: states.START, data: {} };

  // Global restart handler
  if (incomingMsg === "0") {
    currentState[from] = { state: states.START, data: {} };
    const restartMessage = "Thank you for using Zimseek! 👋";
    try {
      res.set("Content-Type", "text/xml");
      res.send(`<Response><Message>${restartMessage}</Message></Response>`);
      return;
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      res.status(500).send("Error sending WhatsApp message");
      return;
    }
  }

  const state = currentState[from].state;
  const data = currentState[from].data;

  switch (state) {
    case states.START:
      message = "Hello 👋, welcome to Zimseek! Are you a:\n1️⃣ Buyer\n2️⃣ Seller";
      currentState[from].state = states.REG_CHOICE;
      break;

    case states.REG_CHOICE:
      if (incomingMsg === "1" || /buyer/i.test(incomingMsg)) {
        message = "Are you already registered?\n1️⃣ Yes\n2️⃣ No";
        currentState[from].state = states.BUYER_REG_ALREADY;
        data.businessType = "buyer";
      } else if (incomingMsg === "2" || /seller/i.test(incomingMsg)) {
        message =
          "Select Seller Type:\n1️⃣ Retailer / Vendor\n2️⃣ Farmer / Producer";
        currentState[from].state = states.SELLER_TYPE;
        data.businessType = "seller";
      } else {
        message = "Please reply 1️⃣ for Buyer or 2️⃣ for Seller.";
      }
      break;

    case states.BUYER_REG_ALREADY:
      if (incomingMsg === "0") {
        message = "Restarting...";
        currentState[from].state = states.START;
        break;
      }
      if (incomingMsg === "1") {
        message = "Please enter your registered phone number to login:";
        currentState[from].state = states.BUYER_REG_PHONE;
        data.isLogin = true;
      } else if (incomingMsg === "2") {
        message = "Please enter your Name:";
        currentState[from].state = states.BUYER_REG_NAME;
        data.isLogin = false;
      } else {
        message =
          "Please reply 1️⃣ for Yes or 2️⃣ for No.\nType 0 to back to start";
      }
      break;

    case states.BUYER_REG_NAME:
      if (incomingMsg === "0") {
        message = "Restarting...";
        currentState[from].state = states.START;
        break;
      }
      data.name = incomingMsg;
      message = "Enter Phone:";
      currentState[from].state = states.BUYER_REG_PHONE;
      break;

    case states.BUYER_REG_PHONE:
      if (incomingMsg === "0") {
        message = "Restarting...";
        currentState[from].state = states.START;
        break;
      }
      data.phone = incomingMsg;
      if (data.isLogin) {
        const buyerSnap = await db
          .ref("buyers")
          .orderByChild("phone")
          .equalTo(data.phone)
          .once("value");
        const buyers = buyerSnap.val();
        if (buyers && Object.keys(buyers).length > 0) {
          const buyerId = Object.keys(buyers)[0];
          data.buyerId = buyerId;
          data.name = buyers[buyerId].name;
          message = `🎉 Welcome back, ${data.name}! 👋\n\n🛒 What would you like to do today?\n\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit\n`;
          currentState[from].state = states.BUYER_MENU;
        } else {
          message =
            "No buyer found with this phone. Please register (reply 2️⃣).\nType 0 to back to start";
          currentState[from].state = states.BUYER_REG_ALREADY;
        }
      } else {
        // Check if phone number already exists for buyers
        const existingBuyerSnap = await db
          .ref("buyers")
          .orderByChild("phone")
          .equalTo(data.phone)
          .once("value");
        const existingBuyers = existingBuyerSnap.val();

        if (existingBuyers && Object.keys(existingBuyers).length > 0) {
          message = `❌ Phone number ${data.phone} is already registered as a buyer.\n\nPlease enter a different phone number:`;
          // Stay in the same state to wait for new phone number
        } else {
          message = `Confirm ✅\nName: ${data.name}\nPhone: ${data.phone}\n\nReply 1️⃣ to Confirm, 2️⃣ to Cancel.\nType 0 to back to start`;
          currentState[from].state = states.BUYER_REG_CONFIRM;
        }
      }
      break;

    case states.BUYER_REG_CONFIRM:
      if (incomingMsg === "0") {
        message = "Restarting...";
        currentState[from].state = states.START;
        break;
      }
      if (incomingMsg === "1") {
        const buyerId = await registerBuyer(
          data.name,
          data.phone,
          new Date().toISOString()
        );
        data.buyerId = buyerId;
        safeSendMail({
          from: process.env.GODADDY_EMAIL,
          to: data.email || process.env.GODADDY_EMAIL, // Fallback if email not collected
          subject: "Welcome to Zimseek!",
          text: `Hello ${data.name},\n\nWelcome to Zimseek as a buyer! Your account is now active.`,
        });
        safeSendMail({
          from: process.env.GODADDY_EMAIL,
          to: process.env.GODADDY_EMAIL,
          subject: "New Buyer Registered",
          text: `A new buyer has registered:\nName: ${data.name}\nPhone: ${data.phone}`,
        });
        message = `🎉 Registration complete! Welcome to Zimseek, ${data.name}! 🎊\n\n🛒 What would you like to do?\n\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit\n`;
        currentState[from].state = states.BUYER_MENU;
      } else if (incomingMsg === "2") {
        message = "Registration cancelled. Restarting...";
        currentState[from].state = states.START;
      } else {
        message =
          "Please reply 1 to Confirm or 2 to Cancel.\nType 0 to back to start";
      }
      break;

    case states.BUYER_BUSINESS_TYPE:
      if (incomingMsg === "0") {
        message = "Restarting...";
        currentState[from].state = states.START;
        break;
      }
      if (incomingMsg === "1") {
        data.searchType = "retailer";
        message = `🎉 Welcome to Zimseek, ${data.name}! 👋\n\n🛒 What would you like to do?\n\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit\n`;
        currentState[from].state = states.BUYER_MENU;
      } else if (incomingMsg === "2") {
        data.searchType = "farmer";
        message = `🎉 Welcome to Zimseek, ${data.name}! 👋\n\n🛒 What would you like to do?\n\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit\n`;
        currentState[from].state = states.BUYER_MENU;
      } else {
        message =
          "Please reply 1️⃣ for Retailer or 2️⃣ for Farmer.\nType 0 to back to start";
      }
      break;

    case states.SELLER_TYPE:
      if (incomingMsg === "1") {
        message = "Are you already registered?\n1️⃣ Yes\n2️⃣ No";
        currentState[from].state = states.REG_ALREADY;
        data.businessType = "retailer";
      } else if (incomingMsg === "2") {
        message = "Are you already registered?\n1️⃣ Yes\n2️⃣ No";
        currentState[from].state = states.FARMER_REG_ALREADY;
        data.businessType = "farmer";
      } else {
        message = "Please reply 1️⃣ for Retailer or 2️⃣ for Farmer.";
      }
      break;

    case states.FARMER_REG_ALREADY:
      if (incomingMsg === "1") {
        message = "Please enter your registered phone number to login:";
        currentState[from].state = states.FARMER_REG_PHONE;
        data.isLogin = true;
      } else if (incomingMsg === "2") {
        message = "Please enter your Name:";
        currentState[from].state = states.FARMER_REG_NAME;
        data.isLogin = false;
      } else {
        message = "Please reply 1️⃣ for Yes or 2️⃣ for No.";
      }
      break;

    case states.FARMER_REG_NAME:
      data.name = incomingMsg;
      message = "Enter your Email:";
      currentState[from].state = states.FARMER_REG_EMAIL;
      break;

    case states.FARMER_REG_EMAIL:
      data.email = incomingMsg;
      message = "Enter your Farm Name:";
      currentState[from].state = states.FARMER_REG_FARM;
      break;

    case states.FARMER_REG_FARM:
      data.farmName = incomingMsg;
      message = "Enter your Phone:";
      currentState[from].state = states.FARMER_REG_PHONE;
      break;

    case states.FARMER_REG_PHONE:
      data.phone = incomingMsg;
      if (data.isLogin) {
        const sellerSnap = await db
          .ref("sellers")
          .orderByChild("phone")
          .equalTo(data.phone)
          .once("value");
        const sellers = sellerSnap.val();
        if (sellers && Object.keys(sellers).length > 0) {
          const sellerId = Object.keys(sellers)[0];
          data.sellerId = sellerId;
          data.name = sellers[sellerId].sellerName;
          message = `🎉 Welcome back, ${data.name}! 👋\n\n🚜 Farmer Dashboard - What would you like to do?\n\n1️⃣ ➕ Add Produce Listing\n2️⃣ 📋 View My Listings\n3️⃣ ✏️ Edit Listings\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit\n`;
          currentState[from].state = states.FARMER_MENU;
        } else {
          message =
            "No farmer found with this phone. Please register as a new farmer (reply 2️⃣).";
          currentState[from].state = states.FARMER_REG_ALREADY;
        }
      } else {
        // Check if phone number already exists for farmers
        const existingFarmerSnap = await db
          .ref("sellers")
          .orderByChild("phone")
          .equalTo(data.phone)
          .once("value");
        const existingFarmers = existingFarmerSnap.val();

        if (existingFarmers && Object.keys(existingFarmers).length > 0) {
          message = `❌ Phone number ${data.phone} is already registered as a farmer.\n\nPlease enter a different phone number:`;
          // Stay in the same state to wait for new phone number
        } else {
          message = "Enter your City:";
          currentState[from].state = states.FARMER_REG_CITY;
        }
      }
      break;

    case states.FARMER_REG_CITY:
      data.city = incomingMsg;
      message = "Enter your Suburb:";
      currentState[from].state = states.FARMER_REG_SUBURB;
      break;

    case states.FARMER_REG_SUBURB:
      data.suburb = incomingMsg;
      message = `Confirm Registration:\nName: ${data.name}\nEmail: ${data.email}\nFarm: ${data.farmName}\nPhone: ${data.phone}\nCity: ${data.city}\nSuburb: ${data.suburb}\n\nReply 1️⃣ to Confirm, 2️⃣ to Cancel.`;
      currentState[from].state = states.FARMER_REG_CONFIRM;
      break;

    case states.FARMER_REG_CONFIRM:
      if (incomingMsg === "1") {
        const sellerId = await registerSeller(
          data.name.toLowerCase(),
          data.farmName.toLowerCase(),
          data.email.toLowerCase(),
          data.phone,
          "farmer",
          data.city.toLowerCase(),
          data.suburb.toLowerCase(),
          new Date().toISOString()
        );
        data.sellerId = sellerId;
        safeSendMail({
          from: process.env.GODADDY_EMAIL,
          to: data.email,
          subject: "Welcome to Zimseek!",
          text: `Hello ${data.name},\n\nWelcome to Zimseek as a farmer! Your account is now active.`,
        });
        safeSendMail({
          from: process.env.GODADDY_EMAIL,
          to: process.env.GODADDY_EMAIL,
          subject: "New Farmer Registered",
          text: `A new farmer has registered:\nName: ${data.name}\nFarm: ${data.farmName}\nPhone: ${data.phone}\nCity: ${data.city}\nSuburb: ${data.suburb}`,
        });
        message = `🎉 Registration complete! Welcome to Zimseek, ${data.name}! 🎊\n\n🚜 Farmer Dashboard - What would you like to do?\n\n1️⃣ ➕ Add Produce Listing\n2️⃣ 📋 View My Listings\n3️⃣ ✏️ Edit Listings\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit\n`;
        currentState[from].state = states.FARMER_MENU;
      } else {
        message = "Registration cancelled. Start again? (Reply 1 for Yes)";
        currentState[from].state = states.START;
      }
      break;

    case states.REG_ALREADY:
      if (incomingMsg === "1") {
        message = "Please enter your registered phone number to login:";
        currentState[from].state = states.REG_PHONE;
        data.isLogin = true;
      } else if (incomingMsg === "2") {
        message = "1️⃣ Enter Name:";
        currentState[from].state = states.REG_NAME;
        data.isLogin = false;
      } else {
        message = "Please reply 1️⃣ for Yes or 2️⃣ for No.";
      }
      break;

    case states.REG_PHONE:
      data.phone = incomingMsg;
      if (data.isLogin) {
        const sellerSnap = await db
          .ref("sellers")
          .orderByChild("phone")
          .equalTo(data.phone)
          .once("value");
        const sellers = sellerSnap.val();
        if (sellers && Object.keys(sellers).length > 0) {
          const sellerId = Object.keys(sellers)[0];
          data.sellerId = sellerId;
          data.name = sellers[sellerId].sellerName;
          message = `🎉 Welcome back, ${data.name}! 👋\n\n🏪 Seller Dashboard - What would you like to do?\n\n1️⃣ ➕ Add New Product\n2️⃣ 📋 View My Products\n3️⃣ ✏️ Edit Product\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit\n`;
          currentState[from].state = states.MENU;
        } else {
          message =
            "No seller found with this phone. Please register as a new seller (reply 2️⃣).";
          currentState[from].state = states.REG_ALREADY;
        }
      } else {
        // Check if phone number already exists for sellers
        const existingSellerSnap = await db
          .ref("sellers")
          .orderByChild("phone")
          .equalTo(data.phone)
          .once("value");
        const existingSellers = existingSellerSnap.val();

        if (existingSellers && Object.keys(existingSellers).length > 0) {
          message = `❌ Phone number ${data.phone} is already registered as a seller.\n\nPlease enter a different phone number:`;
          // Stay in the same state to wait for new phone number
        } else {
          message = "5️⃣ Enter City:";
          currentState[from].state = states.REG_CITY;
        }
      }
      break;

    case states.REG_NAME:
      data.name = incomingMsg;
      message = "2️⃣ Enter Store Name:";
      currentState[from].state = states.REG_STORE;
      break;

    case states.REG_STORE:
      data.storeName = incomingMsg.toLowerCase();
      message = "3️⃣ Enter Email:";
      currentState[from].state = states.REG_EMAIL;
      break;

    case states.REG_EMAIL:
      data.email = incomingMsg.toLowerCase();
      message = "4️⃣ Enter Phone:";
      currentState[from].state = states.REG_PHONE;
      break;

    case states.REG_CITY:
      data.city = incomingMsg;
      message = "6️⃣ Enter Suburb:";
      currentState[from].state = states.REG_SUBURB;
      break;

    case states.REG_SUBURB:
      data.suburb = incomingMsg;
      message = `6️⃣ Confirm Registration:\nName: ${data.name}\nStore: ${data.storeName}\nEmail: ${data.email}\nPhone: ${data.phone}\nCity: ${data.city}\nSuburb: ${data.suburb}\n\nReply 1️⃣ to Confirm, 2️⃣ to Cancel.`;
      currentState[from].state = states.REG_CONFIRM;
      break;

    case states.REG_CONFIRM:
      if (incomingMsg === "1") {
        const sellerId = await registerSeller(
          data.name.toLowerCase(),
          data.storeName.toLowerCase(),
          data.email.toLowerCase(),
          data.phone,
          "retailer",
          data.city.toLowerCase(),
          data.suburb.toLowerCase(),
          new Date().toISOString()
        );
        data.sellerId = sellerId;
        safeSendMail({
          from: process.env.GODADDY_EMAIL,
          to: data.email,
          subject: "Welcome to Zimseek!",
          text: `Hello ${data.name},\n\nWelcome to Zimseek as a seller! Your account is now active.`,
        });
        safeSendMail({
          from: process.env.GODADDY_EMAIL,
          to: process.env.GODADDY_EMAIL,
          subject: "New Seller Registered",
          text: `A new seller has registered:\nName: ${data.name}\nStore: ${data.storeName}\nPhone: ${data.phone}\nCity: ${data.city}\nSuburb: ${data.suburb}`,
        });
        message = `🎉 Registration complete! Welcome to Zimseek, ${data.name}! 🎊\n\n🏪 Seller Dashboard - What would you like to do?\n\n1️⃣ ➕ Add New Product\n2️⃣ 📋 View My Products\n3️⃣ ✏️ Edit Product\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit\n`;
        currentState[from].state = states.MENU;
      } else {
        message = "Registration cancelled. Start again? (Reply 1 for Yes)";
        currentState[from].state = states.START;
      }
      break;

    case states.BUYER_REG_ALREADY:
      if (incomingMsg === "0") {
        message = "Restarting...";
        currentState[from].state = states.START;
        break;
      }
      if (incomingMsg === "1") {
        message = "Please enter your registered phone number to login:";
        currentState[from].state = states.BUYER_REG_PHONE;
        data.isLogin = true;
      } else if (incomingMsg === "2") {
        message = "Please enter your Name:";
        currentState[from].state = states.BUYER_REG_NAME;
        data.isLogin = false;
      } else {
        message =
          "Please reply 1️⃣ for Yes or 2️⃣ for No.\nType 0 to back to start";
      }
      break;

    case states.BUYER_REG_NAME:
      if (incomingMsg === "0") {
        message = "Restarting...";
        currentState[from].state = states.START;
        break;
      }
      data.name = incomingMsg;
      message = "Enter Phone:";
      currentState[from].state = states.BUYER_REG_PHONE;
      break;

    case states.BUYER_REG_PHONE:
      if (incomingMsg === "0") {
        message = "Restarting...";
        currentState[from].state = states.START;
        break;
      }
      data.phone = incomingMsg;
      if (data.isLogin) {
        const buyerSnap = await db
          .ref("buyers")
          .orderByChild("phone")
          .equalTo(data.phone)
          .once("value");
        const buyers = buyerSnap.val();
        if (buyers && Object.keys(buyers).length > 0) {
          const buyerId = Object.keys(buyers)[0];
          data.buyerId = buyerId;
          data.name = buyers[buyerId].name;
          message = `🎉 Welcome back, ${data.name}! 👋\n\n🛒 What would you like to do today?\n\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit\n`;
          currentState[from].state = states.BUYER_MENU;
        } else {
          message =
            "No buyer found with this phone. Please register (reply 2️⃣).\nType 0 to back to start";
        }
      } else {
        message =
          "Confirm ✅\nChoose the type of business you want to search products from:\n1️⃣ Retailer / Vendor\n2️⃣ Farmer / Producer\nType 0 to back to start";
        currentState[from].state = states.BUYER_BUSINESS_TYPE;
      }
      break;

    case states.BUYER_BUSINESS_TYPE:
      if (incomingMsg === "0") {
        message = "Restarting...";
        currentState[from].state = states.START;
        break;
      }
      if (incomingMsg === "1") {
        data.searchType = "retailer";
        message = `🎉 Welcome to Zimseek, ${data.name}! 👋\n\n🛒 What would you like to do?\n\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit\n`;
        currentState[from].state = states.BUYER_MENU;
      } else if (incomingMsg === "2") {
        data.searchType = "farmer";
        message = `🎉 Welcome to Zimseek, ${data.name}! 👋\n\n🛒 What would you like to do?\n\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit\n`;
        currentState[from].state = states.BUYER_MENU;
      } else {
        message =
          "Please reply 1️⃣ for Retailer or 2️⃣ for Farmer.\nType 0 to back to start";
      }
      break;

    case states.BUYER_MENU:
      if (incomingMsg === "0") {
        message = "Restarting...";
        currentState[from].state = states.START;
        break;
      }
      if (incomingMsg === "1") {
        message =
          "Choose the type of business to search products from:\n1️⃣ Retailer / Vendor\n2️⃣ Farmer / Producer\nType 0 to back to start";
        currentState[from].state = states.BUYER_SEARCH_TYPE;
      } else if (incomingMsg === "2") {
        message =
          "Please type your message for admin:\nType 0 to back to start";
        currentState[from].state = states.contact_admin;
      } else if (incomingMsg === "3") {
        message = "Thank you for using Zimseek! 👋";
        currentState[from].state = states.START;
      } else {
        message =
          "Invalid input. Choose an option:\n1️⃣ Search for Products/Listings\n2️⃣ Contact Admin\n3️⃣ Exit\nType 0 to back to start";
      }
      break;

    case states.BUYER_SEARCH_TYPE:
      if (incomingMsg === "0") {
        message = `🎉 Welcome to Zimseek, ${data.name}! 👋\n\n🛒 What would you like to do?\n\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit\n`;
        currentState[from].state = states.BUYER_MENU;
        break;
      }
      if (incomingMsg === "1") {
        data.searchType = "retailer";
        let catMsg = "Step 1 – Select Category you wanna search for:\n";
        categories.forEach((cat, idx) => {
          catMsg += `${idx + 1}️⃣ ${cat}\n`;
        });
        message = catMsg.trim() + "\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_CATEGORY;
      } else if (incomingMsg === "2") {
        data.searchType = "farmer";
        let catMsg = "Step 1 – Select Category you wanna search for:\n";
        farmerCategories.forEach((cat, idx) => {
          catMsg += `${idx + 1}️⃣ ${cat}\n`;
        });
        message = catMsg.trim() + "\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_CATEGORY;
      } else {
        message =
          "Please reply 1️⃣ for Retailer or 2️⃣ for Farmer.\nType 0 to back to menu";
      }
      break;
    case states.BUYER_SEARCH_CATEGORY:
      if (incomingMsg === "0") {
        message = `🎉 Welcome to Zimseek, ${data.name}! 👋\n\n🛒 What would you like to do?\n\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit\n`;
        currentState[from].state = states.BUYER_MENU;
        break;
      }
      const searchCategories =
        data.searchType === "retailer" ? categories : farmerCategories;
      const idx = parseInt(incomingMsg) - 1;
      if (idx >= 0 && idx < searchCategories.length) {
        data.searchCategory = searchCategories[idx];
        const subProducts =
          data.searchType === "retailer"
            ? retailerSubProducts[data.searchCategory]
            : farmerSubProducts[data.searchCategory] || ["Other"];
        let prodMsg = `You selected: ${data.searchCategory}.\nStep 2 – Choose Product:\n`;
        subProducts.forEach((prod, i) => {
          prodMsg += `${i + 1}️⃣ ${prod}\n`;
        });
        message = prodMsg.trim() + "\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_PRODUCT;
      } else {
        let catMsg = "Step 1 – Select Category you wanna search for:\n";
        searchCategories.forEach((cat, idx) => {
          catMsg += `${idx + 1}️⃣ ${cat}\n`;
        });
        message = catMsg.trim() + "\nType 0 to back to menu";
      }
      break;

    case states.BUYER_SEARCH_PRODUCT:
      if (incomingMsg === "0") {
        let catMsg = "Step 1 – Select Category you wanna search for:\n";
        const searchCategories =
          data.searchType === "retailer" ? categories : farmerCategories;
        searchCategories.forEach((cat, idx) => {
          catMsg += `${idx + 1}️⃣ ${cat}\n`;
        });
        message = catMsg.trim() + "\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_CATEGORY;
        break;
      }
      const subProducts =
        data.searchType === "retailer"
          ? retailerSubProducts[data.searchCategory]
          : farmerSubProducts[data.searchCategory] || ["Other"];
      const indx = parseInt(incomingMsg) - 1;
      if (indx >= 0 && indx < subProducts.length) {
        if (subProducts[indx] === "Other") {
          message =
            "Type your product name (e.g., chilli):\nType 0 to back to menu";
          currentState[from].state = states.BUYER_SEARCH_PRODUCT_CUSTOM;
        } else {
          data.searchProduct = subProducts[indx].toLowerCase();
          let cityMsg = "Step 3 – Location Filter:\n";
          zimbabweCities.forEach((city, idx) => {
            cityMsg += `${idx + 1}️⃣ ${city}\n`;
          });
          cityMsg += "6️⃣ Other (type city/suburb)";
          message = cityMsg + "\nType 0 to back to menu";
          currentState[from].state = states.BUYER_SEARCH_LOCATION;
        }
      } else {
        let prodMsg = `You selected: ${data.searchCategory}.\nStep 2 – Choose Product:\n`;
        subProducts.forEach((prod, i) => {
          prodMsg += `${i + 1}️⃣ ${prod}\n`;
        });
        message = prodMsg.trim() + "\nType 0 to back to menu";
      }
      break;

    case states.BUYER_SEARCH_PRODUCT_CUSTOM:
      if (incomingMsg === "0") {
        let prodMsg = `You selected: ${data.searchCategory}.\nStep 2 – Choose Product:\n`;
        const subProducts =
          data.searchType === "retailer"
            ? retailerSubProducts[data.searchCategory]
            : farmerSubProducts[data.searchCategory] || ["Other"];
        subProducts.forEach((prod, i) => {
          prodMsg += `${i + 1}️⃣ ${prod}\n`;
        });
        message = prodMsg.trim() + "\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_PRODUCT;
        break;
      }
      data.searchProduct = incomingMsg.toLowerCase();
      // Fuzzy matching
      const allProducts = [].concat(
        ...Object.values(retailerSubProducts),
        ...Object.values(farmerSubProducts)
      );
      const suggestions = allProducts.filter((prod) =>
        prod.toLowerCase().startsWith(data.searchProduct)
      );
      if (suggestions.length > 0) {
        let suggestionMsg = `Did you mean one of these? (Type number or retype)\n`;
        suggestions.forEach((prod, i) => {
          suggestionMsg += `${i + 1}️⃣ ${prod}\n`;
        });
        suggestionMsg += `${
          suggestions.length + 1
        }️⃣ None of these (retry)\nType 0 to back to menu`;
        message = suggestionMsg;
        data.suggestions = suggestions;
        currentState[from].state = states.BUYER_SEARCH_PRODUCT_SUGGESTIONS;
      } else {
        let cityMsg = "Step 3 – Location Filter:\n";
        zimbabweCities.forEach((city, idx) => {
          cityMsg += `${idx + 1}️⃣ ${city}\n`;
        });
        cityMsg += "6️⃣ Other (type city/suburb)";
        message = cityMsg + "\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_LOCATION;
      }
      break;

    case states.BUYER_SEARCH_PRODUCT_SUGGESTIONS:
      if (incomingMsg === "0") {
        message = `You selected: ${data.searchCategory}.\nStep 2 – Choose Product:\n`;
        const subProducts =
          data.searchType === "retailer"
            ? retailerSubProducts[data.searchCategory]
            : farmerSubProducts[data.searchCategory] || ["Other"];
        subProducts.forEach((prod, i) => {
          message += `${i + 1}️⃣ ${prod}\n`;
        });
        message += "\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_PRODUCT;
        break;
      }
      const suggestionIdx = parseInt(incomingMsg) - 1;
      if (suggestionIdx >= 0 && suggestionIdx < data.suggestions.length) {
        data.searchProduct = data.suggestions[suggestionIdx].toLowerCase();
        let cityMsg = "Step 3 – Location Filter:\n";
        zimbabweCities.forEach((city, idx) => {
          cityMsg += `${idx + 1}️⃣ ${city}\n`;
        });
        cityMsg += "6️⃣ Other (type city/suburb)";
        message = cityMsg + "\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_LOCATION;
      } else if (incomingMsg === (data.suggestions.length + 1).toString()) {
        message =
          "Type your product name again (e.g., chilli):\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_PRODUCT_CUSTOM;
      } else {
        message =
          "Invalid selection. Please try again.\nType 0 to back to menu";
      }
      break;

    case states.BUYER_SEARCH_LOCATION:
      if (incomingMsg === "0") {
        message = `You selected: ${data.searchCategory}.\nStep 2 – Choose Product:\n`;
        const subProducts =
          data.searchType === "retailer"
            ? retailerSubProducts[data.searchCategory]
            : farmerSubProducts[data.searchCategory] || ["Other"];
        subProducts.forEach((prod, i) => {
          message += `${i + 1}️⃣ ${prod}\n`;
        });
        message += "\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_PRODUCT;
        break;
      }
      const cityIdx = parseInt(incomingMsg) - 1;
      data.searchLocation =
        cityIdx >= 0 && cityIdx < zimbabweCities.length
          ? zimbabweCities[cityIdx].toLowerCase()
          : incomingMsg.toLowerCase();
      // Fetch and display results (simulated)
      let results = [];
      if (data.searchType === "retailer") {
        const productsSnap = await db.ref("products").once("value");
        const productsVal = productsSnap.val() || {};
        for (const [pid, product] of Object.entries(productsVal)) {
          if (
            product.category &&
            product.name &&
            product.city &&
            product.category.toLowerCase() ===
              data.searchCategory.toLowerCase() &&
            (product.name.toLowerCase().includes(data.searchProduct) ||
              data.searchProduct.includes(product.name.toLowerCase()) ||
              product.name.toLowerCase() === data.searchProduct) &&
            product.city.toLowerCase().includes(data.searchLocation)
          ) {
            let sellerName = "Unknown Seller";
            if (product.sellerId) {
              const seller = (
                await db.ref(`sellers/${product.sellerId}`).once("value")
              ).val();
              if (seller) {
                sellerName =
                  seller.storeOrFarmName ||
                  seller.storeName ||
                  seller.sellerName ||
                  seller.farmName ||
                  sellerName;
              }
            }
            results.push({
              sellerName,
              price: product.price,
              city: product.city,
              suburb: product.suburb,
              productId: pid,
            });
          }
        }
      } else {
        const listingsSnap = await db.ref("farmerListings").once("value");
        const listingsVal = listingsSnap.val() || {};
        for (const [lid, listing] of Object.entries(listingsVal)) {
          if (
            listing.category &&
            listing.productName &&
            listing.city &&
            listing.category.toLowerCase() ===
              data.searchCategory.toLowerCase() &&
            (listing.productName.toLowerCase().includes(data.searchProduct) ||
              data.searchProduct.includes(listing.productName.toLowerCase()) ||
              listing.productName.toLowerCase() === data.searchProduct) &&
            listing.city.toLowerCase().includes(data.searchLocation)
          ) {
            let sellerName = "Unknown Farmer";
            if (listing.farmerId) {
              const seller = (
                await db.ref(`sellers/${listing.farmerId}`).once("value")
              ).val();
              if (seller) {
                sellerName =
                  seller.storeOrFarmName ||
                  seller.farmName ||
                  seller.sellerName ||
                  seller.storeName ||
                  sellerName;
              }
            }
            results.push({
              sellerName,
              price: listing.price,
              city: listing.city,
              suburb: listing.suburb,
              listingId: lid,
            });
          }
        }
      }
      results.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      if (results.length > 0) {
        message = `✅ prices for ${data.searchProduct} – ${data.searchLocation}:\n`;
        results.slice(0, 3).forEach((result, i) => {
          message += `${i + 1}️⃣ Store Name: ${result.sellerName}\n   Price: $${
            result.price
          }\n   City: ${result.city || "Unknown"}\n   Suburb: ${
            result.suburb || "Unknown"
          }\n\n`;
        });
        message +=
          "\n⚡Type the number to contact seller directly.\nType 0 to back to menu";
        data.searchResults = results;
        currentState[from].state = states.BUYER_SEARCH_RESULTS;
      } else {
        message = `No ${data.searchProduct} found in ${data.searchLocation}.\nType 0 to back to menu`;
        currentState[from].state = states.BUYER_SEARCH_LOCATION;
      }
      break;

    case states.BUYER_SEARCH_RESULTS:
      if (incomingMsg === "0") {
        let cityMsg = "Step 3 – Location Filter:\n";
        zimbabweCities.forEach((city, idx) => {
          cityMsg += `${idx + 1}️⃣ ${city}\n`;
        });
        cityMsg += "6️⃣ Other (type city/suburb)";
        message = cityMsg + "\nType 0 to back to menu";
        currentState[from].state = states.BUYER_SEARCH_LOCATION;
        break;
      }
      const resultIdx = parseInt(incomingMsg) - 1;
      if (resultIdx >= 0 && resultIdx < data.searchResults.length) {
        const selectedResult = data.searchResults[resultIdx];
        data.selectedResult = selectedResult;
        if (data.searchType === "retailer") {
          const productSnap = await db
            .ref(`products/${selectedResult.productId}`)
            .once("value");
          const product = productSnap.val() || {};
          let seller = null;
          if (product.sellerId) {
            seller = (
              await db.ref(`sellers/${product.sellerId}`).once("value")
            ).val();
          }
          const sellerDisplayName =
            seller?.storeOrFarmName ||
            seller?.storeName ||
            seller?.sellerName ||
            "Unknown";
          const sellerPhone = seller?.phone || "Unknown";
          const sellerEmail = seller?.email || "Unknown";
          const sellerCity = seller?.city || product.city || "Unknown";
          const sellerSuburb = seller?.suburb || product.suburb || "Unknown";
          const price = product.price || selectedResult.price || "Unknown";
          message =
            `Seller Name: ${sellerDisplayName}\n` +
            `Contact: ${sellerPhone}\n` +
            `Email: ${sellerEmail}\n` +
            `City/Suburb: ${sellerCity}, ${sellerSuburb}\n\n` +
            `Product: ${product.name || "Unknown"}\n` +
            `Category: ${product.category || "Unknown"}\n` +
            `Price: ${price}\n` +
            `Location: ${product.city || sellerCity}, ${
              product.suburb || sellerSuburb
            }\n\n` +
            `🛒 Buyer Menu:\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit`;
          currentState[from].state = states.BUYER_MENU;
        } else {
          const listingSnap = await db
            .ref(`farmerListings/${selectedResult.listingId}`)
            .once("value");
          const listing = listingSnap.val() || {};
          let seller = null;
          if (listing.farmerId) {
            seller = (
              await db.ref(`sellers/${listing.farmerId}`).once("value")
            ).val();
          }
          const sellerDisplayName =
            seller?.storeOrFarmName ||
            seller?.farmName ||
            seller?.sellerName ||
            "Unknown";
          const sellerPhone = seller?.phone || "Unknown";
          const sellerEmail = seller?.email || "Unknown";
          const sellerCity = seller?.city || listing.city || "Unknown";
          const sellerSuburb = seller?.suburb || listing.suburb || "Unknown";
          const price = listing.price || selectedResult.price || "Unknown";
          message =
            `Seller Name: ${sellerDisplayName}\n` +
            `Contact: ${sellerPhone}\n` +
            `Email: ${sellerEmail}\n` +
            `City/Suburb: ${sellerCity}, ${sellerSuburb}\n\n` +
            `Product: ${listing.productName || "Unknown"}\n` +
            `Category: ${listing.category || "Unknown"}\n` +
            `Price: ${price}\n` +
            `Location: ${listing.city || sellerCity}, ${
              listing.suburb || sellerSuburb
            }\n\n` +
            `🛒 Buyer Menu:\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit`;
          currentState[from].state = states.BUYER_MENU;
        }
      } else {
        message = `Invalid selection. ${data.searchProduct} – ${data.searchLocation}:\n`;
        data.searchResults.slice(0, 3).forEach((result, i) => {
          message += `${i + 1}️⃣ ${result.sellerName} – $${result.price} – ${
            result.suburb
          }\n`;
        });
        message +=
          "\n⚡Type the number to contact seller directly.\nType 0 to back to menu";
      }
      break;

    case states.BUYER_CONNECT_SELLER:
      // This state is terminal; user chats directly with seller
      // Implement actual chat logic (e.g., Twilio) and reset if needed
      message =
        "Chat session active. Type 'exit' to return.\nType 0 to back to start";
      if (incomingMsg.toLowerCase() === "exit") {
        message = `🎉 Welcome to Zimseek, ${data.name}! 👋\n\n🛒 What would you like to do?\n\n1️⃣ 🔍 Search Products & Listings\n2️⃣ 📞 Contact Support\n3️⃣ 🚪 Exit\n`;
        currentState[from].state = states.BUYER_MENU;
      }
      break;

    case states.MENU:
      if (incomingMsg === "1") {
        let catMsg = "Step 1 – Choose Category:\n";
        categories.forEach((cat, idx) => {
          catMsg += `${idx + 1}️⃣ ${cat}\n`;
        });
        message = catMsg.trim();
        currentState[from].state = states.ADD_CATEGORY;
      } else if (incomingMsg === "2") {
        if (!data.sellerId) {
          message = "Please login again.";
          currentState[from].state = states.START;
        } else {
          const products = await fetchRetailerProducts(data.sellerId);
          if (products) {
            message = "Your Products:\n";
            Object.values(products).forEach((p, idx) => {
              message += `${idx + 1}. ${p.name} - ${p.category} - ${p.price} (${
                p.city
              }, ${p.suburb})\n`;
            });
          } else {
            message = "No products found. \n";
          }
          message +=
            "\n🏪 Seller Menu:\n1️⃣ ➕ Add New Product\n2️⃣ 📋 View My Products\n3️⃣ ✏️ Edit Product\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit";
          currentState[from].state = states.MENU;
        }
      } else if (incomingMsg === "3") {
        if (!data.sellerId) {
          message = "Please login again.";
          currentState[from].state = states.START;
        } else {
          const products = await fetchRetailerProducts(data.sellerId);
          if (products && Object.keys(products).length > 0) {
            message = "Select a product to edit:\n";
            data.products = Object.entries(products);
            data.products.forEach(([id, p], idx) => {
              message += `${idx + 1}. ${p.name} - ${p.category} - ${p.price} (${
                p.city
              }, ${p.suburb})\n`;
            });
            currentState[from].state = states.SELECT_PRODUCT;
          } else {
            message =
              "No products found to edit.\n\nSeller Menu:\n1️⃣ Add New Product\n2️⃣ View My Products\n3️⃣ Edit Product\n4️⃣ Contact Admin\n5️⃣ Exit";
            currentState[from].state = states.MENU;
          }
        }
      } else if (incomingMsg === "4") {
        if (!data.sellerId) {
          message = "Please login again.";
          currentState[from].state = states.START;
        } else {
          message = "Please type your message for admin:";
          currentState[from].state = states.contact_admin;
        }
      } else if (incomingMsg === "5") {
        message = "Thank you for using Zimseek! 👋";
        currentState[from].state = states.START;
      } else {
        message =
          "❌ Invalid input. 🏪 Seller Menu:\n1️⃣ ➕ Add New Product\n2️⃣ 📋 View My Products\n3️⃣ ✏️ Edit Product\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit";
      }
      break;

    case states.SELECT_PRODUCT:
      {
        const idx = parseInt(incomingMsg) - 1;
        if (idx >= 0 && idx < data.products.length) {
          data.selectedProduct = data.products[idx];
          message =
            "Which field would you like to edit?\n1️⃣ Product Name\n2️⃣ Price\n3️⃣ City\n4️⃣ Suburb\n5️⃣ Category";
          data.editField = null; // Reset
          currentState[from].state = states.EDIT_FIELD;
        } else {
          message =
            "Invalid product selection. Please select a number from the list.";
        }
      }
      break;

    case states.EDIT_FIELD:
      {
        const [productId, product] = data.selectedProduct;
        if (!data.editField) {
          // Field selection step
          if (["1", "2", "3", "4", "5"].includes(incomingMsg)) {
            data.editField = incomingMsg;
            if (incomingMsg === "1") {
              message = "Enter new Product Name (e.g., Tomatoes):";
            } else if (incomingMsg === "2") {
              message = "Enter new Price (e.g., 5 per kg):";
            } else if (incomingMsg === "3") {
              let cityMsg = "Enter new City:\n";
              zimbabweCities.forEach((city, idx) => {
                cityMsg += `${idx + 1}. ${city}\n`;
              });
              message = cityMsg.trim();
            } else if (incomingMsg === "4") {
              message = "Enter new Suburb:";
            } else if (incomingMsg === "5") {
              let catMsg = "Choose new Category:\n";
              categories.forEach((cat, idx) => {
                catMsg += `${idx + 1}️⃣ ${cat}\n`;
              });
              message = catMsg.trim();
            }
          } else {
            message =
              "Invalid field. Please select:\n1️⃣ Product Name\n2️⃣ Price\n3️⃣ City\n4️⃣ Suburb\n5️⃣ Category";
          }
        } else {
          // Field input step
          const updates = {};
          if (data.editField === "1") {
            updates.name = incomingMsg.toLowerCase();
          } else if (data.editField === "2") {
            updates.price = incomingMsg;
          } else if (data.editField === "3") {
            const idx = parseInt(incomingMsg) - 1;
            updates.city =
              idx >= 0 && idx < zimbabweCities.length
                ? zimbabweCities[idx].toLowerCase()
                : product.city;
          } else if (data.editField === "4") {
            updates.suburb = incomingMsg.toLowerCase();
          } else if (data.editField === "5") {
            const idx = parseInt(incomingMsg) - 1;
            updates.category =
              idx >= 0 && idx < categories.length
                ? categories[idx].toLowerCase()
                : product.category;
          }
          const updatedProduct = { ...product, ...updates };
          message = `Confirm Update:\nProduct: ${updatedProduct.name}\nCategory: ${updatedProduct.category}\nPrice: ${updatedProduct.price}\nCity: ${updatedProduct.city}\nSuburb: ${updatedProduct.suburb}\n\nReply 1️⃣ to Confirm, 2️⃣ to Cancel.`;
          data.updates = updates;
          currentState[from].state = states.EDIT_CONFIRM;
        }
      }
      break;

    case states.EDIT_CONFIRM:
      if (incomingMsg === "1") {
        const [productId] = data.selectedProduct;
        await updateRetailerProduct(productId, data.updates);
        safeSendMail({
          from: process.env.GODADDY_EMAIL,
          to: process.env.GODADDY_EMAIL,
          subject: "Product Updated",
          text: `Seller: ${
            data.name
          }\nProduct ID: ${productId}\nUpdates: ${JSON.stringify(
            data.updates
          )}`,
        });
        message =
          "✅ Product updated successfully!\n\nSeller Menu:\n1️⃣ Add New Product\n2️⃣ View My Products\n3️⃣ Edit Product\n4️⃣ Contact Admin\n5️⃣ Exit";
        data.editField = null; // Reset
        data.updates = {}; // Clear
        data.selectedProduct = null; // Optional cleanup
        currentState[from].state = states.MENU;
      } else {
        message =
          "Update cancelled.\n\nSeller Menu:\n1️⃣ Add New Product\n2️⃣ View My Products\n3️⃣ Edit Product\n4️⃣ Contact Admin\n5️⃣ Exit";
        data.editField = null; // Reset
        data.updates = {}; // Clear
        data.selectedProduct = null; // Optional
        currentState[from].state = states.MENU;
      }
      break;

    case states.FARMER_MENU:
      if (incomingMsg === "1") {
        message =
          "Choose product category:\n1️⃣ Grains and Cereals\n2️⃣ Legumes and Pulses\n3️⃣ Fresh Produce\n4️⃣ Livestock and Animal Products\n5️⃣ Cash Crops\n6️⃣ Other Farm Products";
        currentState[from].state = states.FARMER_ADD_CATEGORY;
      } else if (incomingMsg === "2") {
        const listings = await fetchFarmerListings(data.sellerId);
        if (listings) {
          message = "Your Listings:\n";
          Object.values(listings).forEach((l, idx) => {
            message += `${idx + 1}. ${l.productName} - ${l.category} - ${
              l.price
            } (${l.city}, ${l.suburb})\n`;
          });
        } else {
          message = "No listings found. \n";
        }
        message +=
          "\n🚜 Farmer Menu:\n1️⃣ ➕ Add Produce Listing\n2️⃣ 📋 View My Listings\n3️⃣ ✏️ Edit Listings\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit";
        currentState[from].state = states.FARMER_MENU;
      } else if (incomingMsg === "3") {
        if (!data.sellerId) {
          message = "Please login again.";
          currentState[from].state = states.START;
        } else {
          const listings = await fetchFarmerListings(data.sellerId);
          if (listings && Object.keys(listings).length > 0) {
            message = "Select a listing to edit:\n";
            data.listings = Object.entries(listings);
            data.listings.forEach(([id, l], idx) => {
              message += `${idx + 1}. ${l.productName} - ${l.category} - ${
                l.price
              } (${l.city}, ${l.suburb})\n`;
            });
            currentState[from].state = states.FARMER_SELECT_LISTING;
          } else {
            message =
              "No listings found to edit.\n\nFarmer Menu:\n1️⃣ Add Produce Listing\n2️⃣ View My Listings\n3️⃣ Edit Listings\n4️⃣ Contact Admin\n5️⃣ Exit";
            currentState[from].state = states.FARMER_MENU;
          }
        }
      } else if (incomingMsg === "4") {
        if (!data.sellerId) {
          message = "Please login again.";
          currentState[from].state = states.START;
        } else {
          message =
            "Please type your message for admin:\nType 0 to back to main menu";
          currentState[from].state = states.contact_admin; // Use the defined state
        }
      } else if (incomingMsg === "5") {
        message = "Thank you for using Zimseek! 👋";
        currentState[from].state = states.START;
      } else {
        message =
          "❌ Invalid input. 🚜 Farmer Menu:\n1️⃣ ➕ Add Produce Listing\n2️⃣ 📋 View My Listings\n3️⃣ ✏️ Edit Listings\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit";
      }
      break;

    case states.FARMER_ADD_CATEGORY:
      {
        const idx = parseInt(incomingMsg) - 1;
        if (idx >= 0 && idx < farmerCategories.length) {
          data.category = farmerCategories[idx];
          const subProducts = farmerSubProducts[data.category] || ["Other"];
          let subProductMsg = `${data.category}. Pick product:\n`;
          subProducts.forEach((prod, i) => {
            subProductMsg += `${i + 1}️⃣ ${prod}\n`;
          });
          message = subProductMsg.trim();
          currentState[from].state = states.FARMER_ADD_SUBPRODUCT;
        } else {
          message = "Invalid category. Please enter a number from the list.";
        }
      }
      break;

    case states.FARMER_ADD_SUBPRODUCT:
      {
        const subProducts = farmerSubProducts[data.category] || ["Other"];
        const idx = parseInt(incomingMsg) - 1;
        if (idx >= 0 && idx < subProducts.length) {
          if (subProducts[idx] === "Other") {
            message =
              "Enter your product name (e.g., Custom Product):\nType 0 to back to main menu";
            currentState[from].state = states.FARMER_ADD_SUBPRODUCT_CUSTOM;
          } else {
            data.productName = subProducts[idx].toLowerCase();
            message =
              "Enter your price per unit (e.g., 1 kg = $1.20):\nType 0 to back to main menu";
            currentState[from].state = states.FARMER_ADD_PRICE;
          }
        } else {
          let subProductMsg = `${data.category}. Pick product:\n`;
          subProducts.forEach((prod, i) => {
            subProductMsg += `${i + 1}️⃣ ${prod}\n`;
          });
          message = subProductMsg.trim() + "\nType 0 to back to main menu";
        }
      }
      break;
    case states.FARMER_ADD_SUBPRODUCT_CUSTOM:
      if (incomingMsg === "0") {
        message =
          "🚜 Farmer Menu:\n1️⃣ ➕ Add Produce Listing\n2️⃣ 📋 View My Listings\n3️⃣ ✏️ Edit Listings\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit";
        currentState[from].state = states.FARMER_MENU;
        break;
      }
      {
        data.productName = incomingMsg.toLowerCase();
        message =
          "Enter your price per unit (e.g., 1 kg = $1.20):\nType 0 to back to main menu";
        currentState[from].state = states.FARMER_ADD_PRICE;
      }
      break;

    case states.FARMER_ADD_QUANTITY:
      data.quantity = incomingMsg;
      message = "Enter your price per unit (e.g., 1 kg = $1.20):";
      currentState[from].state = states.FARMER_ADD_PRICE;
      break;

    case states.FARMER_ADD_PRICE:
      data.price = incomingMsg;
      let citiesMsg = "Enter your City:\n";
      zimbabweCities.forEach((city, idx) => {
        citiesMsg += `${idx + 1}. ${city}\n`;
      });
      message = citiesMsg.trim();
      currentState[from].state = states.FARMER_ADD_LOCATION;
      break;

    case states.FARMER_ADD_LOCATION:
      {
        const idx = parseInt(incomingMsg) - 1;
        data.city =
          idx >= 0 && idx < zimbabweCities.length
            ? zimbabweCities[idx]
            : incomingMsg;
        message = "Enter your Suburb:";
        currentState[from].state = states.FARMER_ADD_SUBURB;
      }
      break;

    case states.FARMER_ADD_SUBURB:
      data.suburb = incomingMsg;
      await addFarmerListing(
        data.sellerId,
        data.productName.toLowerCase(),
        data.category.toLowerCase(),
        data.price,
        data.city.toLowerCase(),
        data.suburb.toLowerCase(),
        new Date().toISOString()
      );
      safeSendMail({
        from: process.env.GODADDY_EMAIL,
        to: process.env.GODADDY_EMAIL,
        subject: "New Farmer Listing Added",
        text: `Farmer: ${data.name}\nProduct: ${data.productName}\nCategory: ${data.category}\nPrice: ${data.price}\nCity: ${data.city}\nSuburb: ${data.suburb}`,
      });
      message = `✅ Listing Added Successfully!\n\nProduct Name: ${data.productName}\nCategory: ${data.category}\nPrice: ${data.price}\nCity: ${data.city}\nSuburb: ${data.suburb}\n\nMenu:\n1️⃣ Add another product\n2️⃣ Back to Farmer Menu`;
      currentState[from].state = states.FARMER_ADD_CONFIRM;
      break;

    case states.FARMER_ADD_CONFIRM:
      if (incomingMsg === "1") {
        message =
          "Choose product category:\n1️⃣ Grains and Cereals\n2️⃣ Legumes and Pulses\n3️⃣ Fresh Produce\n4️⃣ Livestock and Animal Products\n5️⃣ Cash Crops\n6️⃣ Other Farm Products";
        currentState[from].state = states.FARMER_ADD_CATEGORY;
      } else if (incomingMsg === "2") {
        message =
          "🚜 Farmer Menu:\n1️⃣ ➕ Add Produce Listing\n2️⃣ 📋 View My Listings\n3️⃣ ✏️ Edit Listings\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit";
        currentState[from].state = states.FARMER_MENU;
      } else {
        message =
          "Invalid input. Reply 1️⃣ Add another product or 2️⃣ Back to Farmer Menu.";
      }
      break;

    case states.FARMER_SELECT_LISTING:
      {
        const idx = parseInt(incomingMsg) - 1;
        if (idx >= 0 && idx < data.listings.length) {
          data.selectedListing = data.listings[idx];
          message =
            "Which field would you like to edit?\n1️⃣ Product Name\n2️⃣ Price\n3️⃣ City\n4️⃣ Suburb\n5️⃣ Category";
          data.editField = null; // Reset editField
          currentState[from].state = states.FARMER_EDIT_FIELD;
        } else {
          message =
            "Invalid listing selection. Please select a number from the list.";
        }
      }
      break;

    case states.FARMER_EDIT_FIELD:
      {
        const [listingId, listing] = data.selectedListing;
        if (!data.editField) {
          // Field selection step
          if (["1", "2", "3", "4", "5"].includes(incomingMsg)) {
            data.editField = incomingMsg;
            if (incomingMsg === "1") {
              message = "Type an updated product name (example: maize):";
            } else if (incomingMsg === "2") {
              message = "Enter new Price (e.g., 5 per kg):";
            } else if (incomingMsg === "3") {
              let cityMsg = "Enter new City:\n";
              zimbabweCities.forEach((city, idx) => {
                cityMsg += `${idx + 1}. ${city}\n`;
              });
              message = cityMsg.trim();
            } else if (incomingMsg === "4") {
              message = "Enter new Suburb:";
            } else if (incomingMsg === "5") {
              let catMsg = "Choose new Category:\n";
              farmerCategories.forEach((cat, idx) => {
                catMsg += `${idx + 1}️⃣ ${cat}\n`;
              });
              message = catMsg.trim();
            }
          } else {
            message =
              "Invalid field. Please select:\n1️⃣ Product Name\n2️⃣ Price\n3️⃣ City\n4️⃣ Suburb\n5️⃣ Category";
          }
        } else {
          // Field input step
          const updates = {};
          if (data.editField === "1") {
            updates.productName = incomingMsg.toLowerCase();
            const updatedListing = { ...listing, ...updates };
            message = `Confirm Update:\nProduct: ${updatedListing.productName}\nCategory: ${updatedListing.category}\nPrice: ${updatedListing.price}\nCity: ${updatedListing.city}\nSuburb: ${updatedListing.suburb}\n\nReply 1️⃣ to Confirm, 2️⃣ to Cancel.`;
            data.updates = updates;
            currentState[from].state = states.FARMER_EDIT_CONFIRM;
          } else if (data.editField === "2") {
            updates.price = incomingMsg;
            const updatedListing = { ...listing, ...updates };
            message = `Confirm Update:\nProduct: ${updatedListing.productName}\nCategory: ${updatedListing.category}\nPrice: ${updatedListing.price}\nCity: ${updatedListing.city}\nSuburb: ${updatedListing.suburb}\n\nReply 1️⃣ to Confirm, 2️⃣ to Cancel.`;
            data.updates = updates;
            currentState[from].state = states.FARMER_EDIT_CONFIRM;
          } else if (data.editField === "3") {
            const idx = parseInt(incomingMsg) - 1;
            updates.city =
              idx >= 0 && idx < zimbabweCities.length
                ? zimbabweCities[idx].toLowerCase()
                : listing.city;
            const updatedListing = { ...listing, ...updates };
            message = `Confirm Update:\nProduct: ${updatedListing.productName}\nCategory: ${updatedListing.category}\nPrice: ${updatedListing.price}\nCity: ${updatedListing.city}\nSuburb: ${updatedListing.suburb}\n\nReply 1️⃣ to Confirm, 2️⃣ to Cancel.`;
            data.updates = updates;
            currentState[from].state = states.FARMER_EDIT_CONFIRM;
          } else if (data.editField === "4") {
            updates.suburb = incomingMsg.toLowerCase();
            const updatedListing = { ...listing, ...updates };
            message = `Confirm Update:\nProduct: ${updatedListing.productName}\nCategory: ${updatedListing.category}\nPrice: ${updatedListing.price}\nCity: ${updatedListing.city}\nSuburb: ${updatedListing.suburb}\n\nReply 1️⃣ to Confirm, 2️⃣ to Cancel.`;
            data.updates = updates;
            currentState[from].state = states.FARMER_EDIT_CONFIRM;
          } else if (data.editField === "5") {
            const idx = parseInt(incomingMsg) - 1;
            updates.category =
              idx >= 0 && idx < farmerCategories.length
                ? farmerCategories[idx].toLowerCase()
                : listing.category;
            const updatedListing = { ...listing, ...updates };
            message = `Confirm Update:\nProduct: ${updatedListing.productName}\nCategory: ${updatedListing.category}\nPrice: ${updatedListing.price}\nCity: ${updatedListing.city}\nSuburb: ${updatedListing.suburb}\n\nReply 1️⃣ to Confirm, 2️⃣ to Cancel.`;
            data.updates = updates;
            currentState[from].state = states.FARMER_EDIT_CONFIRM;
          }
        }
      }
      break;

    case states.FARMER_EDIT_CONFIRM:
      if (incomingMsg === "1") {
        const [listingId] = data.selectedListing;
        await updateFarmerListing(listingId, data.updates);
        safeSendMail({
          from: process.env.GODADDY_EMAIL,
          to: process.env.GODADDY_EMAIL,
          subject: "Farmer Listing Updated",
          text: `Farmer: ${
            data.name
          }\nListing ID: ${listingId}\nUpdates: ${JSON.stringify(
            data.updates
          )}`,
        });
        message =
          "✅ Listing updated successfully!\n\nFarmer Menu:\n1️⃣ Add Produce Listing\n2️⃣ View My Listings\n3️⃣ Edit Listings\n4️⃣ Contact Admin\n5️⃣ Exit";
        data.editField = null;
        data.updates = {};
        data.selectedListing = null;
        currentState[from].state = states.FARMER_MENU;
      } else {
        message =
          "Update cancelled.\n\nFarmer Menu:\n1️⃣ Add Produce Listing\n2️⃣ View My Listings\n3️⃣ Edit Listings\n4️⃣ Contact Admin\n5️⃣ Exit";
        data.editField = null;
        data.updates = {};
        data.selectedListing = null;
        currentState[from].state = states.FARMER_MENU;
      }
      break;

    case states.ADD_CATEGORY:
      {
        const idx = parseInt(incomingMsg) - 1;
        if (idx >= 0 && idx < categories.length) {
          data.category = categories[idx];
          const subProducts = retailerSubProducts[data.category] || ["Other"];
          let prodMsg = `You chose: ${data.category}\nStep 2 – Pick product:\n`;
          subProducts.forEach((prod, i) => {
            prodMsg += `${i + 1}️⃣ ${prod}\n`;
          });
          message = prodMsg.trim() + "\nType 0 to back to main menu";
          currentState[from].state = states.ADD_NAME;
        } else {
          let catMsg = "Step 1 – Choose Category:\n";
          categories.forEach((cat, idx) => {
            catMsg += `${idx + 1}️⃣ ${cat}\n`;
          });
          message = catMsg.trim();
        }
      }
      break;

    case states.ADD_NAME:
      {
        const subProducts = retailerSubProducts[data.category] || ["Other"];
        const idx = parseInt(incomingMsg) - 1;
        if (idx >= 0 && idx < subProducts.length) {
          if (subProducts[idx] === "Other") {
            message =
              "Type your product name (example: custom item):\nType 0 to back to main menu";
            currentState[from].state = states.ADD_NAME_CUSTOM; // New state for custom input
          } else {
            data.productName = subProducts[idx].toLowerCase();
            message = "Step 3 - Enter Price (e.g., 5 per kg):";
            currentState[from].state = states.ADD_PRICE;
          }
        } else {
          let prodMsg = `You chose: ${data.category}\nStep 2 – Pick product:\n`;
          subProducts.forEach((prod, i) => {
            prodMsg += `${i + 1}️⃣ ${prod}\n`;
          });
          message = prodMsg.trim() + "\nType 0 to back to main menu";
        }
      }
      break;

    case states.ADD_NAME_CUSTOM:
      {
        data.productName = incomingMsg.toLowerCase();
        message = "Enter Price (e.g., 5 per kg):\nType 0 to back to main menu";
        currentState[from].state = states.ADD_PRICE;
      }
      break;

    case states.ADD_PRICE:
      data.price = incomingMsg;
      let cityMsg = "Step 4 – Enter City:\n";
      zimbabweCities.forEach((city, idx) => {
        cityMsg += `${idx + 1}️⃣ ${city}\n`;
      });
      message = cityMsg.trim();
      currentState[from].state = states.ADD_LOCATION;
      break;

    case states.ADD_LOCATION:
      {
        const idx = parseInt(incomingMsg) - 1;
        data.city =
          idx >= 0 && idx < zimbabweCities.length
            ? zimbabweCities[idx]
            : incomingMsg;
        message = "Step 5 – Enter Suburb:";
        currentState[from].state = states.ADD_SUBURB;
      }
      break;

    case states.ADD_SUBURB:
      data.suburb = incomingMsg;
      await addProduct(
        data.sellerId,
        data.productName.toLowerCase(),
        data.category.toLowerCase(),
        data.city.toLowerCase(),
        data.price,
        data.suburb.toLowerCase(),
        new Date().toISOString()
      );
      safeSendMail({
        from: process.env.GODADDY_EMAIL,
        to: process.env.GODADDY_EMAIL,
        subject: "New Product Added",
        text: `Seller: ${data.name}\nProduct: ${data.productName}\nCategory: ${data.category}\nCity: ${data.city}\nSuburb: ${data.suburb}\nPrice: ${data.price}`,
      });
      message = `✅ Product Added Successfully!\n\nProduct Name: ${data.productName}\nCategory: ${data.category}\nPrice: ${data.price}\nCity: ${data.city}\nSuburb: ${data.suburb}\n\nMenu:\n1️⃣ Add Another Product\n2️⃣ Back to Main Menu`;
      currentState[from].state = states.ADD_CONFIRM;
      break;

    case states.ADD_CONFIRM:
      if (incomingMsg === "1") {
        let catMsg = "Step 1 – Choose Category:\n";
        categories.forEach((cat, idx) => {
          catMsg += `${idx + 1}️⃣ ${cat}\n`;
        });
        message = catMsg;
        currentState[from].state = states.ADD_CATEGORY;
      } else if (incomingMsg === "2") {
        message =
          "🏪 Seller Menu:\n1️⃣ ➕ Add New Product\n2️⃣ 📋 View My Products\n3️⃣ ✏️ Edit Product\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit";
        currentState[from].state = states.MENU;
      } else {
        message =
          "Invalid input. Reply 1️⃣ Add Another Product or 2️⃣ Back to Main Menu.";
      }
      break;

    case states.contact_admin:
      if (!data.sellerId) {
        message = "Please login again.";
        currentState[from].state = states.START;
      } else {
        const sellerName = data.name || "Unknown Seller";
        const sellerPhone = data.phone || "Unknown Phone";
        const sellerType = data.businessType || "unknown";
        safeSendMail({
          from: process.env.GODADDY_EMAIL,
          to: process.env.GODADDY_EMAIL,
          subject: `${
            sellerType.charAt(0).toUpperCase() + sellerType.slice(1)
          } Contact Admin`,
          text: `Seller: ${sellerName} (Phone: ${sellerPhone})\nType: ${sellerType}\nMessage: ${
            incomingMsg || "No message provided"
          }`,
        });
        message =
          "Your message has been sent to admin.\n\n" +
          (data.businessType === "farmer"
            ? "🚜 Farmer Menu:\n1️⃣ ➕ Add Produce Listing\n2️⃣ 📋 View My Listings\n3️⃣ ✏️ Edit Listings\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit"
            : "🏪 Seller Menu:\n1️⃣ ➕ Add New Product\n2️⃣ 📋 View My Products\n3️⃣ ✏️ Edit Product\n4️⃣ 📞 Contact Support\n5️⃣ 🚪 Exit") +
          "\nType 0 to back to main menu";
        currentState[from].state =
          data.businessType === "farmer" ? states.FARMER_MENU : states.MENU;
      }
      break;

    default:
      message = "Invalid state. Restarting...";
      currentState[from].state = states.START;
  }
  try {
    res.set("Content-Type", "text/xml");
    res.send(
      `<Response><Message>${normalizeRestartPrompt(
        message
      )}</Message></Response>`
    );
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    res.status(500).send("Error sending WhatsApp message");
  }
});

module.exports = router;
