const admin = require("firebase-admin");
const serviceAccount = require("../firebaseServiceAccount");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://zimlowprice-default-rtdb.firebaseio.com/",
});

module.exports = admin.database();
