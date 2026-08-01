const express = require("express");
const axios = require("axios");
const router = express.Router();
const {
  API_BASE,
  BASE_URL,
  normalizeTypes,
  prefixImageUrls,
} = require("./utils");

router.get("/", async (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 24;
  const types = normalizeTypes(req.query.types, ["Manga", "Manwha", "Manhua"]);

  try {
    const params = { offset, limit, types };

    const response = await axios.get(`${API_BASE}/hotArrivals`, {
      params,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: `${BASE_URL}/`,
      },
    });

    res.json(prefixImageUrls(response.data));
  } catch (error) {
    console.error("[AtsuMoe Hot Arrivals] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch hot arrivals",
      message: error.message,
    });
  }
});

module.exports = router;
