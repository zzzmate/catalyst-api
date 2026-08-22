const express = require("express");
const router = express.Router();

const scrapeRouter = require("./scrape");

router.use("/scrape", scrapeRouter);

module.exports = router;