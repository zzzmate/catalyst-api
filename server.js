const express = require("express");
const app = express();
const PORT = 5177;

app.set("trust proxy", true);

const mangafireRoutes = require("./routes/mangafire");
const mangapillRoutes = require("./routes/mangapill");
const mangadotnetRoutes = require("./routes/mangadotnet");
const atsumoeRoutes = require("./routes/atsumoe");
const weebcentralRoutes = require("./routes/weebcentral");
const mangagoRoutes = require("./routes/mangago");
const anidbRoutes = require("./routes/anidb");
const vidhawkRoutes = require("./routes/vidhawk");

app.get("/", (req, res) => {
  res.send(`
    catalyst api started

    Docs: https://zzmate.hu/catalyst
  `);
});

app.use("/mangafire", mangafireRoutes);
app.use("/mangapill", mangapillRoutes);
app.use("/mangadotnet", mangadotnetRoutes);
app.use("/atsumoe", atsumoeRoutes);
app.use("/weebcentral", weebcentralRoutes);
app.use("/mangago", mangagoRoutes);
app.use("/anidb", anidbRoutes);
app.use("/vidhawk", vidhawkRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log("catalyst api started");
});
