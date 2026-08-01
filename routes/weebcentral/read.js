const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

const BASE_URL = "https://weebcentral.com";

router.get("/:chapterId", async (req, res) => {
  const { chapterId } = req.params;

  try {
    const url = `${BASE_URL}/chapters/${chapterId}/images?reading_style=long_strip`;
    console.log("[WeebCentral Read] Fetching:", url);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        Referer: `${BASE_URL}/chapters/${chapterId}`,
      },
    });

    const $ = cheerio.load(response.data);
    const pages = [];

    $("img").each((i, el) => {
      const $el = $(el);
      const src = $el.attr("src") || "";
      const alt = $el.attr("alt") || "";

      if (!src || src.includes("broken_image")) return;
      if (!src.startsWith("http")) return;

      const pageNumMatch = alt.match(/Page\s+(\d+)/i);
      const pageNum = pageNumMatch
        ? parseInt(pageNumMatch[1])
        : pages.length + 1;

      pages.push({
        page: pageNum,
        url: src,
        alt,
      });
    });

    res.json({
      chapterId,
      totalPages: pages.length,
      pages,
    });
  } catch (error) {
    console.error("[WeebCentral Read] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch chapter pages",
      message: error.message,
    });
  }
});

module.exports = router;
