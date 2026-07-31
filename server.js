const express = require("express");
const app = express();
const PORT = 5177;

const mangafireRoutes = require("./routes/mangafire");

app.get("/", (req, res) => {
  res.send("catalyst api started");
});

app.use("/mangafire", mangafireRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log("catalyst api started");
});
