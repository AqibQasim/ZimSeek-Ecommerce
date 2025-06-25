const express = require("express");
const app = express();
const appRoutes = require("./routes/appRoutes"); // Updated path

app.use(express.urlencoded({ extended: true }));
app.use("/whatsapp", appRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
