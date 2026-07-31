const express = require("express");
const app = express();
const PORT = 5177;

const mangafireRoutes = require("./routes/mangafire");
const mangapillRoutes = require("./routes/mangapill");

app.get("/", (req, res) => {
  res.send("catalyst api started");
});

app.use("/mangafire", mangafireRoutes);
app.use("/mangapill", mangapillRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log("catalyst api started");
});
