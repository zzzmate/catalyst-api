const express = require("express");
const axios = require("axios");
const router = express.Router();
const latestRouter = require("./latest");
const browseRouter = require("./browse");
const infoRouter = require("./info");
const readRouter = require("./read");
const proxyRouter = require("./proxy");

router.get("/trending", async (req, res) => {
  try {
    const { limit = 30, days = 1, page = 1 } = req.query;

    const response = await axios.get("https://mangafire.to/api/top-titles", {
      params: {
        type: "trending",
        days,
        limit,
        page,
      },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://mangafire.to/",
        Accept: "application/json",
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching trending data:", error.message);
    res.status(500).json({
      error: "Failed to fetch trending data",
      message: error.message,
    });
  }
});

router.use("/latest_uploads", latestRouter);
router.use("/browse", browseRouter);
router.use("/info", infoRouter);
router.use("/read", readRouter);
router.use("/proxy", proxyRouter);

module.exports = router;
