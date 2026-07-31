const express = require("express");
const axios = require("axios");
const router = express.Router();
const {
  API_URL,
  getOrigin,
  getRange,
  normalizeAdult,
  proxifyPhotos,
} = require("./utils");

router.get("/", async (req, res) => {
  const range = getRange(req.query.range);
  const type = req.query.type || "all";
  const limit = parseInt(req.query.limit) || 21;
  const adult = normalizeAdult(req.query.adult);
  const origin = getOrigin(type);

  try {
    const params = {
      id: "top_rated",
      adult,
      range,
      origin,
      limit,
    };

    const response = await axios.get(API_URL, {
      params,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://mangadot.net/",
      },
    });

    res.json(proxifyPhotos(response.data, req));
  } catch (error) {
    console.error("[MangaDotNet Top Rated] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch top rated",
      message: error.message,
    });
  }
});

module.exports = router;
