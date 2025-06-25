const readline = require("readline");
const { registerBuyer, getBuyerByPhone } = require("../models/buyer");
const { registerSeller, getSellerByEmail } = require("../models/seller");
const db = require("../config/firebase");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (question) =>
  new Promise((resolve) => rl.question(question, resolve));

async function startApp() {
  console.log("Hello, welcome to Zimseek");
  const userType = await prompt("Are you a buyer or seller? (buyer/seller): ");

  if (userType.toLowerCase() === "seller") {
    await handleSellerFlow();
  } else if (userType.toLowerCase() === "buyer") {
    await handleBuyerFlow();
  } else {
    console.log('Invalid choice. Please type "buyer" or "seller".');
    await startApp();
  }
}

async function handleSellerFlow() {
  const hasAccount = await prompt("Are you already registered? (yes/no): ");
  let sellerId;

  if (hasAccount.toLowerCase() === "yes") {
    const email = await prompt("Enter your email: ");
    sellerId = await getSellerByEmail(email);
    if (sellerId) {
      console.log("Retrieved sellerId:", sellerId); // Debug log
      const seller = await getSellerDetails(sellerId);
      console.log("Seller data:", seller); // Debug log
      console.log(`Welcome back, ${seller?.sellerName || "Unknown"}!`);
    } else {
      console.log("No account found with that email.");
      const register = await prompt("Would you like to register? (yes/no): ");
      if (register.toLowerCase() === "yes") {
        sellerId = await registerSellerFlow();
      } else {
        await startApp();
        return;
      }
    }
  } else {
    sellerId = await registerSellerFlow();
  }

  await require("./productController").handleProductFlow(sellerId);
}

async function registerSellerFlow() {
  const sellerName = await prompt("Enter your name: ");
  const storeName = await prompt("Enter your store name: ");
  const email = await prompt("Enter your email: ");
  const phone = await prompt("Enter your phone number: ");
  const businessType = await prompt(
    "Enter your business type (e.g., Cooperative, Retail): "
  );
  const city = await prompt("Enter your city: ");
  const suburb = await prompt("Enter your suburb: ");
  return await registerSeller(
    sellerName,
    storeName,
    email,
    phone,
    businessType,
    city,
    suburb
  );
}

async function handleBuyerFlow() {
  const hasAccount = await prompt("Are you already registered? (yes/no): ");
  let buyerId;

  if (hasAccount.toLowerCase() === "yes") {
    const phone = await prompt("Enter your phone number: ");
    buyerId = await getBuyerByPhone(phone);
    if (buyerId) {
      const buyer = await getBuyerDetails(buyerId);
      console.log("Buyer data:", buyer);
      //   console.log(`Welcome back, ${await getBuyerDetails(buyerId).name}!`);
      console.log(`Welcome back, ${buyer?.name || "Unknown"}!`);
    } else {
      console.log("No account found with that phone number.");
      const register = await prompt("Would you like to register? (yes/no): ");
      if (register.toLowerCase() === "yes") {
        buyerId = await registerBuyerFlow();
      } else {
        await startApp();
        return;
      }
    }
  } else {
    buyerId = await registerBuyerFlow();
  }

  await require("./productController").handleBuyerQuery(buyerId);
}

async function registerBuyerFlow() {
  const name = await prompt("Enter your name: ");
  const phone = await prompt("Enter your phone number: ");
  return await registerBuyer(name, phone);
}

async function getSellerDetails(sellerId) {
  const snapshot = await db.ref(`sellers/${sellerId}`).once("value");
  const seller = snapshot.val();
  return seller ? seller : { sellerName: "Unknown" };
}

async function getBuyerDetails(buyerId) {
  const snapshot = await db.ref(`buyers/${buyerId}`).once("value");
  const buyer = snapshot.val();
  return buyer ? buyer : { name: "Unknown" };
}

module.exports = { startApp };
