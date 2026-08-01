const express = require("express");
const app = express();
const PORT = 5177;

app.set("trust proxy", true);

const mangafireRoutes = require("./routes/mangafire");
const mangapillRoutes = require("./routes/mangapill");
const mangadotnetRoutes = require("./routes/mangadotnet");
const atsumoeRoutes = require("./routes/atsumoe");

app.get("/", (req, res) => {
  res.send("catalyst api started");
});

app.use("/mangafire", mangafireRoutes);
app.use("/mangapill", mangapillRoutes);
app.use("/mangadotnet", mangadotnetRoutes);
app.use("/atsumoe", atsumoeRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log("catalyst api started");
});
