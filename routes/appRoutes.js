const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const {
  registerSeller,
  getSellerByEmail,
  getSellerByPhone,
} = require("../models/seller");
const { registerBuyer, getBuyerByPhone } = require("../models/buyer");
const { createInquiry } = require("../models/inquiry");
const { createOrder } = require("../models/order");
const {
  addProduct,
  getProductsByCategory,
  getProductsByName,
} = require("../models/product");

const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GODADDY_EMAIL,
    pass: process.env.GODADDY_PASSWORD,
  },
});

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
  // SELLER_ADD_PRODUCT: "seller_add_product",
  // BUYER_QUERY: "buyer_query",
  BUYER_PURCHASE: "buyer_purchase",
  // New states for seller functionality
  SELLER_MENU: "seller_menu", // New state for menu
  SELLER_VIEW_PRODUCTS: "seller_view_products", // New state
  SELLER_VIEW_ORDERS: "seller_view_orders", // New state
  SELLER_CONTACT_ADMIN: "seller_contact_admin", // New state
  SELLER_ADD_PRODUCT: "seller_add_product",
  REGISTRATION_BUYER_EMAIL: "registration_buyer_email",
  BUYER_MENU: "buyer_menu", // New state for buyer menu
  BUYER_VIEW_ORDERS: "buyer_view_orders", // New state
  BUYER_CONTACT_ADMIN: "buyer_contact_admin", // New state
  BUYER_QUERY: "buyer_query",
  BUYER_PURCHASE: "buyer_purchase",
  BUYER_CONFIRM_PURCHASE: "buyer_confirm_purchase",
};

router.post("/message", async (req, res) => {
  console.log("Received message:", req.body.Body, "from:", req.body.From);
  const incomingMsg = req.body.Body ? req.body.Body.toLowerCase().trim() : "";
  const from = req.body.From || "whatsapp:+12183048034";
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
            message = "Enter your phone number:";
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
        message = "Enter your email:";
        currentState[from].state = states.REGISTRATION_BUYER_EMAIL;
      }
      break;

    case states.REGISTRATION_BUYER_EMAIL:
      currentState[from].data.email = incomingMsg;
      message = "Enter your phone number:";
      currentState[from].state = states.REGISTRATION_PHONE;
      break;

    case states.REGISTRATION_STORE:
      currentState[from].data.storeName = incomingMsg;
      message = "Enter your email:";
      currentState[from].state = states.REGISTRATION_EMAIL;
      break;
    // case states.REGISTRATION_EMAIL:
    //   currentState[from].data.email = incomingMsg;
    //   if (currentState[from].data.hasAccount === "yes") {
    //     const sellerId = await getSellerByPhone(incomingMsg);
    //     if (sellerId) {
    //       const seller = (
    //         await db.ref(`sellers/${sellerId}`).once("value")
    //       ).val();
    //       currentState[from].data.sellerId = sellerId;

    //       message = `Welcome back, ${seller.sellerName}! \n Type "add product" to add a new product. \n Or type "done" to end chat.`;
    //       currentState[from].state =
    //         currentState[from].data.userType === "seller"
    //           ? states.SELLER_ADD_PRODUCT
    //           : states.BUYER_QUERY;
    //     } else {
    //       message = 'No account found. Please register with "no".';
    //       currentState[from].state = states.REGISTRATION;
    //     }
    //   } else {
    //     message = "Enter your phone number:";
    //     currentState[from].state = states.REGISTRATION_PHONE;
    //   }
    //   break;
    case states.REGISTRATION_EMAIL:
      currentState[from].data.email = incomingMsg;
      if (currentState[from].data.hasAccount === "yes") {
        const sellerId = await getSellerByPhone(incomingMsg);
        if (sellerId) {
          const seller = (
            await db.ref(`sellers/${sellerId}`).once("value")
          ).val();
          currentState[from].data.sellerId = sellerId;
          message = `Welcome back, ${seller.sellerName}!\nSeller Menu:\n1. Type 1 to Add new product\n2. Type 2 to see all your current products\n3. Type 3 to see all your current order statuses\n4. Type 4 to write a msg to admin\n5. Type 5 to end the chat`;
          currentState[from].state = states.SELLER_MENU;
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
        if (currentState[from].data.userType === "seller") {
          // Existing seller login logic
          const sellerId = await getSellerByPhone(incomingMsg);
          if (sellerId) {
            const seller = (
              await db.ref(`sellers/${sellerId}`).once("value")
            ).val();
            currentState[from].data.sellerId = sellerId;
            message = `Welcome back, ${seller.sellerName}!\nSeller Menu:\n1. Type 1 to Add new product\n2. Type 2 to see all your current products\n3. Type 3 to see all your current order statuses\n4. Type 4 to write a msg to admin\n5. Type 5 to end the chat`;
            currentState[from].state = states.SELLER_MENU;
          } else {
            message = 'No account found. Please register with "no".';
            currentState[from].state = states.REGISTRATION;
          }
        } else {
          // Existing buyer login logic
          const buyerId = await getBuyerByPhone(incomingMsg.toLowerCase());
          if (buyerId) {
            const buyer = (
              await db.ref(`buyers/${buyerId}`).once("value")
            ).val();
            currentState[from].data.buyerId = buyerId;
            message = `Welcome back, ${buyer.name}!\nBuyer Menu:\n1. Type 1 to make an inquiry\n2. Type 2 to see your current order statuses\n3. Type 3 to write a msg to admin\n4. Type 4 to end the chat`;
            currentState[from].state = states.BUYER_MENU;
          } else {
            message = 'No account found. Please register with "no".';
            currentState[from].state = states.REGISTRATION;
          }
        }
      } else {
        if (currentState[from].data.userType === "seller") {
          message = "Enter your business type:";
          currentState[from].state = states.REGISTRATION_BUSINESS;
        } else {
          // Register buyer
          const buyerId = await registerBuyer(
            currentState[from].data.name.toLowerCase(),
            currentState[from].data.email.toLowerCase(),
            incomingMsg.toLowerCase(), // phone number
            new Date().toISOString()
          );

          // After successful buyer registration
          transporter
            .sendMail({
              from: process.env.GODADDY_EMAIL,
              to: currentState[from].data.email,
              subject: "Welcome to Zimseek!",
              text: `Hello ${currentState[from].data.name},\n\nWelcome to Zimseek as a buyer!`,
            })
            .catch((err) =>
              console.error("Failed to send email to seller:", err)
            );
          transporter
            .sendMail({
              from: process.env.GODADDY_EMAIL,
              to: process.env.GODADDY_EMAIL,
              subject: "New Buyer Registered",
              text: `A new buyer has registered:\nName: ${currentState[from].data.name}\nEmail: ${currentState[from].data.email}`,
            })
            .catch((err) =>
              console.error("Failed to send email to seller:", err)
            );

          message = `Welcome, ${currentState[from].data.name}!\nBuyer Menu:\n1. Type 1 to make an inquiry\n2. Type 2 to see your current order statuses\n3. Type 3 to write a msg to admin\n4. Type 4 to end the chat`;
          currentState[from].state = states.BUYER_MENU;
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
    // case states.REGISTRATION_SUBURB:
    //   currentState[from].data.suburb = incomingMsg;
    //   const sellerId = await registerSeller(
    //     currentState[from].data.name,
    //     currentState[from].data.storeName,
    //     currentState[from].data.email,
    //     currentState[from].data.phone,
    //     currentState[from].data.businessType,
    //     currentState[from].data.city,
    //     currentState[from].data.suburb,
    //     new Date().toISOString()
    //   );
    //   currentState[from].data.sellerId = sellerId;
    //   message = `Welcome, ${currentState[from].data.name}! \n Type "add product" to add a new product.`;
    //   currentState[from].state = states.SELLER_ADD_PRODUCT;
    //   break;
    case states.REGISTRATION_SUBURB:
      currentState[from].data.suburb = incomingMsg;
      const sellerId = await registerSeller(
        currentState[from].data.name.toLowerCase(),
        currentState[from].data.storeName.toLowerCase(),
        currentState[from].data.email.toLowerCase(),
        currentState[from].data.phone,
        currentState[from].data.businessType.toLowerCase(),
        currentState[from].data.city.toLowerCase(),
        currentState[from].data.suburb.toLowerCase(),
        new Date().toISOString()
      );
      currentState[from].data.sellerId = sellerId;

      // After successful seller registration
      transporter
        .sendMail({
          from: process.env.GODADDY_EMAIL,
          to: currentState[from].data.email,
          subject: "Welcome to Zimseek!",
          text: `Hello ${currentState[from].data.name},\n\nWelcome to Zimseek as a seller!`,
        })
        .catch((err) => console.error("Failed to send email to seller:", err));
      transporter
        .sendMail({
          from: process.env.GODADDY_EMAIL,
          to: process.env.GODADDY_EMAIL,
          subject: "New Seller Registered",
          text: `A new seller has registered:\nName: ${currentState[from].data.name}\nStore: ${currentState[from].data.storeName}\nEmail: ${currentState[from].data.email}`,
        })
        .catch((err) => console.error("Failed to send email to seller:", err));

      message = `Welcome, ${currentState[from].data.name}!\nSeller Menu:\n1. Type 1 to Add new product\n2. Type 2 to see all your current products\n3. Type 3 to see all your current order statuses\n4. Type 4 to write a msg to admin\n5. Type 5 to end the chat`;
      currentState[from].state = states.SELLER_MENU;

      break;

    // case states.SELLER_ADD_PRODUCT:
    //   if (incomingMsg.toLowerCase() === "add product") {
    //     message =
    //       "Enter product details (NAME | CATEGORY | CITY | PRICE | UNIT):";
    //     currentState[from].state = "seller_add_product_details";
    //   } else if (incomingMsg.toLowerCase() === "done") {
    //     message = "Chat ended. Type anything to start again.";
    //     currentState[from].state = states.START;
    //   } else {
    //     message = 'Type "add product" to add more or "done" to end chat.';
    //   }
    //   break;
    case states.SELLER_ADD_PRODUCT:
      message = `Seller Menu:\n1. Type 1 to Add new product\n2. Type 2 to see all your current products\n3. Type 3 to see all your current order statuses\n4. Type 4 to write a msg to admin\n5. Type 5 to end the chat`;
      currentState[from].state = states.SELLER_MENU;
      break;

    case "seller_add_product_details":
      const [name, category, city, price, unit] = incomingMsg
        .split("|")
        .map((item) => item.trim().toLowerCase());
      if (name && category && city && price && unit) {
        await addProduct(
          currentState[from].data.sellerId,
          name,
          category,
          city,
          price,
          unit,
          new Date().toISOString()
        );
        const seller = (
          await db
            .ref(`sellers/${currentState[from].data.sellerId}`)
            .once("value")
        ).val();

        transporter
          .sendMail({
            from: process.env.GODADDY_EMAIL,
            to: seller.email,
            subject: "Product Added",
            text: `Your product "${name}" has been added successfully.`,
          })
          .catch((err) =>
            console.error("Failed to send email to seller:", err)
          );
        transporter
          .sendMail({
            from: process.env.GODADDY_EMAIL,
            to: process.env.GODADDY_EMAIL,
            subject: "New Product Added",
            text: `Seller: ${seller.sellerName}\nProduct: ${name}\nCategory: ${category}`,
          })
          .catch((err) =>
            console.error("Failed to send email to seller:", err)
          );

        message = `Product ${name} added successfully! Type "add product" to add more or "done" to bck to main menu.`;
        currentState[from].state = states.SELLER_ADD_PRODUCT; // Stay in this state for next input
      } else {
        message = "Invalid format. Use: NAME | CATEGORY | CITY | PRICE | UNIT";
      }
      break;

    case states.SELLER_MENU:
      if (incomingMsg === "1") {
        message =
          "Enter product details (NAME | CATEGORY | CITY | PRICE | UNIT):";
        currentState[from].state = "seller_add_product_details";
      } else if (incomingMsg === "2") {
        const productsRef = db
          .ref("products")
          .orderByChild("sellerId")
          .equalTo(currentState[from].data.sellerId);
        const snapshot = await productsRef.once("value");
        const products = snapshot.val() ? Object.values(snapshot.val()) : [];
        if (products.length > 0) {
          message = "Your Products:\n";
          products.forEach((product) => {
            message += `${product.name} - ${product.category} - $${product.price} ${product.unit} (City: ${product.city})\n`;
          });
        } else {
          message = "No products found in your store.";
        }
        message += "\nReply with any number (1-5) to return to menu.";
        currentState[from].state = states.SELLER_MENU;
      } else if (incomingMsg === "3") {
        const ordersRef = db.ref("orders");
        const snapshot = await ordersRef
          .orderByChild("sellerId")
          .equalTo(currentState[from].data.sellerId)
          .once("value");
        const orders = snapshot.val() || {};
        message = "Your Order Statuses:\n";
        for (const [orderId, order] of Object.entries(orders)) {
          // Fetch buyer name
          let buyerName = "Unknown";
          if (order.buyerId) {
            const buyerSnapshot = await db
              .ref(`buyers/${order.buyerId}`)
              .once("value");
            const buyer = buyerSnapshot.val();
            if (buyer && buyer.name) buyerName = buyer.name;
          }

          // Fetch product name
          let productName = "Unknown";
          if (order.productId) {
            const productSnapshot = await db
              .ref(`products/${order.productId}`)
              .once("value");
            const product = productSnapshot.val();
            if (product && product.name) productName = product.name;
          }

          // Format order time
          const orderTime = order.createdAt || "Unknown";

          message += `Order Id: ${orderId}\nBuyer Name: ${buyerName}\nProduct Name: ${productName}\nOrder Time: ${orderTime}\nOrder Status: ${
            order.status || "Unknown"
          }\n\n`;
        }
        if (Object.keys(orders).length === 0) message = "No orders found.";
        message += "\nReply with any number (1-5) to return to menu.";
        currentState[from].state = states.SELLER_MENU;
      } else if (incomingMsg === "4") {
        message = "Please type your issue to send to admin:";
        currentState[from].state = states.SELLER_CONTACT_ADMIN;
      } else if (incomingMsg === "5") {
        message = "Chat ended. Type anything to start again.";
        currentState[from].state = states.START;
      } else {
        message = `Invalid input. Seller Menu:\n1. Type 1 to Add new product\n2. Type 2 to see all your current products\n3. Type 3 to see all your current order statuses\n4. Type 4 to write a msg to admin\n5. Type 5 to end the chat`;
      }
      break;

    case states.SELLER_CONTACT_ADMIN:
      // const transporter = nodemailer.createTransport({
      //   host: "smtp.office365.com",
      //   port: 587,
      //   secure: false,
      //   auth: {
      //     user: process.env.GODADDY_EMAIL,
      //   },
      // });
      const seller = (
        await db
          .ref(`sellers/${currentState[from].data.sellerId}`)
          .once("value")
      ).val();
      transporter
        .sendMail({
          from: process.env.GODADDY_EMAIL,
          to: process.env.GODADDY_EMAIL,
          subject: "Seller Issue Report",
          text: `Seller: ${seller.sellerName} (Phone: ${seller.phone})\nIssue: ${incomingMsg}`,
        })
        .catch((err) => console.error("Failed to send email to seller:", err));
      message =
        "Issue sent to admin.Admin will get back to you with in 24 hours \n Reply with any number (1-5) to return to menu.";
      currentState[from].state = states.SELLER_MENU;
      break;

    case states.BUYER_QUERY:
      if (incomingMsg.toLowerCase() === "done") {
        message = "Chat ended. Type anything to start again.";
        currentState[from].state = states.START;
      } else {
        const match = incomingMsg.match(/^(\w+)\s+(.+)/i) || [];
        const [_, queryType, queryValue] = match;
        let products = [];
        const productsRef = db.ref("products");

        if (queryType && queryValue) {
          if (queryType.toLowerCase() === "category") {
            // Partial match for category
            const snapshot = await productsRef.once("value");
            const allProducts = snapshot.val()
              ? Object.values(snapshot.val())
              : [];
            products = allProducts.filter(
              (p) =>
                p.category &&
                p.category.toLowerCase().includes(queryValue.toLowerCase())
            );
          } else if (queryType.toLowerCase() === "store") {
            // Partial match for store name
            const sellersSnapshot = await db.ref("sellers").once("value");
            const sellers = sellersSnapshot.val() || {};
            const matchingSellers = Object.entries(sellers).filter(
              ([, s]) =>
                s.storeName &&
                s.storeName.toLowerCase().includes(queryValue.toLowerCase())
            );
            if (matchingSellers.length > 0) {
              const sellerIds = matchingSellers.map(([id]) => id);
              const snapshot = await productsRef.once("value");
              const allProducts = snapshot.val()
                ? Object.values(snapshot.val())
                : [];
              products = allProducts.filter((p) =>
                sellerIds.includes(p.sellerId)
              );
            }
          } else if (queryType.toLowerCase() === "seller") {
            // Partial match for seller name
            const sellersSnapshot = await db.ref("sellers").once("value");
            const sellers = sellersSnapshot.val() || {};
            const matchingSellers = Object.entries(sellers).filter(
              ([, s]) =>
                s.sellerName &&
                s.sellerName.toLowerCase().includes(queryValue.toLowerCase())
            );
            if (matchingSellers.length > 0) {
              const sellerIds = matchingSellers.map(([id]) => id);
              const snapshot = await productsRef.once("value");
              const allProducts = snapshot.val()
                ? Object.values(snapshot.val())
                : [];
              products = allProducts.filter((p) =>
                sellerIds.includes(p.sellerId)
              );
            }
          } else if (queryType.toLowerCase() === "name") {
            products = (await getProductsByName(queryValue)) || [];
          }
        } else {
          products = (await getProductsByName(incomingMsg)) || [];
        }

        // ...rest of your code for showing products...

        if (products.length > 0) {
          message = "Available products:\n";
          for (const product of products) {
            const snapshot = await db
              .ref(`sellers/${product.sellerId}`)
              .once("value");
            const seller = snapshot.val();
            if (seller) {
              message += `${product.name} - ${seller.storeName} - $${product.price} ${product.unit} (City: ${product.city})\n`;
            }
          }
          await createInquiry(
            currentState[from].data.buyerId,
            incomingMsg,
            new Date().toISOString()
          );
          currentState[from].data.products = products;
          message +=
            "\nWould you like to purchase? (yes/no) \nor type 'done' to end the chat.";
          currentState[from].state = states.BUYER_PURCHASE;
        } else {
          message =
            "No products found. Try another query (e.g., 'category grains', 'store xyz', 'seller aqib', 'name chicken').";
        }
        break;
      }
    case states.BUYER_PURCHASE:
      if (incomingMsg.toLowerCase() === "done") {
        message = "Chat ended. Type anything to start again.";
        currentState[from].state = states.START;
      } else if (incomingMsg.toLowerCase() === "yes") {
        message =
          "Enter store name, product name, quantity, and delivery address (e.g., 'xyz store|chicken|2|karachi address'):";
        currentState[from].state = states.BUYER_CONFIRM_PURCHASE;
      } else {
        message =
          'Type "yes" to purchase or query again\nor type "done" to end the chat.';
        currentState[from].state = states.BUYER_QUERY;
      }
      break;

    case states.BUYER_CONFIRM_PURCHASE:
      const [storeName, productName, quantity, deliveryAddress] = incomingMsg
        .split("|")
        .map((item) => item.trim().toLowerCase());
      if (storeName && productName && quantity && deliveryAddress) {
        const products = currentState[from].data.products || [];
        const candidateProduct = products.find(
          (p) => p.name.toLowerCase() === productName.toLowerCase()
        );
        let selectedProduct = null;
        if (candidateProduct) {
          const snapshot = await db
            .ref(`sellers/${candidateProduct.sellerId}`)
            .once("value");
          const seller = snapshot.val();
          if (
            seller &&
            seller.storeName.toLowerCase() === storeName.toLowerCase()
          ) {
            selectedProduct = candidateProduct;
          }
        }
        if (selectedProduct) {
          const orderId = await createOrder(
            currentState[from].data.buyerId,
            selectedProduct.productId,
            selectedProduct.sellerId,
            deliveryAddress.toLowerCase(),
            new Date().toISOString(),
            parseInt(quantity)
          );
          const buyer = (
            await db
              .ref(`buyers/${currentState[from].data.buyerId}`)
              .once("value")
          ).val();

          const seller = (
            await db.ref(`sellers/${selectedProduct.sellerId}`).once("value")
          ).val();

          // console.log(buyer, "buyer  email", seller.email, "Seller email");

          transporter
            .sendMail({
              from: process.env.GODADDY_EMAIL,
              to: buyer.email,
              subject: "Order Confirmation",
              text: `Thank you for your purchase of ${quantity} x ${productName}. Your order ID is ${orderId}.`,
            })
            .catch((err) =>
              console.error("Failed to send email to seller:", err)
            );
          transporter
            .sendMail({
              from: process.env.GODADDY_EMAIL,
              to: seller.email,
              subject: "New Order Received",
              text: `You have received a new order for ${quantity} x ${productName}. Order ID: ${orderId}.`,
            })
            .catch((err) =>
              console.error("Failed to send email to seller:", err)
            );
          transporter
            .sendMail({
              from: process.env.GODADDY_EMAIL,
              to: process.env.GODADDY_EMAIL,
              subject: "New Order Placed",
              text: `Order ID: ${orderId}\nBuyer: ${buyer.name}\nSeller: ${seller.sellerName}\nProduct: ${productName}\nQuantity: ${quantity}`,
            })
            .catch((err) =>
              console.error("Failed to send email to seller:", err)
            );
          message = `✅ Purchase successful!\n\nOrder placed for ${quantity} x ${productName}.\nOrder ID: ${orderId}\nDelivery Address: ${deliveryAddress}\n\nThank you for your order!\n\nType "done" to end the chat or "query" to search for more products.`;
        } else {
          message =
            "No matching product found. Try again with correct store and product.";
        }
      } else {
        message =
          "Invalid format. Use: 'store name|product name|quantity|delivery address'";
      }
      currentState[from].state = states.BUYER_MENU;
      break;

    case states.BUYER_CONTACT_ADMIN:
      // const transporters = nodemailer.createTransport({
      //   host: "smtp.office365.com",
      //   port: 587,
      //   secure: false,
      //   auth: {
      //     user: process.env.GODADDY_EMAIL,
      //   },
      // });
      const buyer = (
        await db.ref(`buyers/${currentState[from].data.buyerId}`).once("value")
      ).val();
      transporter
        .sendMail({
          from: process.env.GODADDY_EMAIL,
          to: process.env.GODADDY_EMAIL,
          subject: "Buyer Issue Report",
          text: `Buyer: ${buyer.name} (Phone: ${buyer.phone})\nIssue: ${incomingMsg}`,
        })
        .catch((err) => console.error("Failed to send email to seller:", err));
      message =
        "Issue sent to admin.Admin will get back to you with in 24 hours \n Reply with any number (1-4) to return to menu.";
      currentState[from].state = states.BUYER_MENU;
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
        if (
          seller &&
          seller.storeName.trim().toLowerCase() ===
            currentState[from].data.storeName.trim().toLowerCase()
        ) {
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
          new Date().toISOString(),
          parseInt(quantity)
        );
        message = `Purchase successful! Order placed! (ID: ${selectedProduct.productId}) \n Thank you for your order from ${currentState[from].data.storeName}. \n Type "done" to end the chat or "query" to search for more products.`;
      } else {
        message =
          "No matching product found for the selected store. Please try again. type 'done' to end the chat or query again to search for more products.";
      }
      currentState[from].state = states.BUYER_QUERY;
      break;

    case states.BUYER_MENU:
      if (incomingMsg === "1") {
        message =
          "Type your search query here. You can search by:\n\n- Category (e.g., category grains)\n- Store (e.g., store xyz)\n- Seller (e.g., seller Aqib)\n- Product name (e.g., name chicken)\n\nSimply enter text in one of these formats to find what you’re looking for.";

        currentState[from].state = states.BUYER_QUERY;
      } else if (incomingMsg === "2") {
        const ordersRef = db
          .ref("orders")
          .orderByChild("buyerId")
          .equalTo(currentState[from].data.buyerId);
        const snapshot = await ordersRef.once("value");
        const orders = snapshot.val() || {};
        message = "Your Order Statuses:\n";
        for (const [orderId, order] of Object.entries(orders)) {
          message += `${orderId}: ${order.status || "Unknown"}\n`;
        }
        if (Object.keys(orders).length === 0) message = "No orders found.";
        message += "\nReply with any number (1-4) to return to menu.";
        currentState[from].state = states.BUYER_MENU;
      } else if (incomingMsg === "3") {
        message = "Please type your issue to send to admin:";
        currentState[from].state = states.BUYER_CONTACT_ADMIN;
      } else if (incomingMsg === "4") {
        message = "Chat ended. Type anything to start again.";
        currentState[from].state = states.START;
      } else {
        message = `Invalid input. Buyer Menu:\n1. Type 1 to make an inquiry\n2. Type 2 to see your current order statuses\n3. Type 3 to write a msg to admin\n4. Type 4 to end the chat`;
      }
      break;

    default:
      message = "Invalid state. Restarting...";
      currentState[from].state = states.START;
  }

  try {
    await client.messages.create({
      body: message,
      from: "whatsapp:+12183048034",
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
