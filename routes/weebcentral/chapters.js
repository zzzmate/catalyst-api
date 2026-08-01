const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

const BASE_URL = "https://weebcentral.com";

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const url = `${BASE_URL}/series/${id}/full-chapter-list`;
    console.log("[WeebCentral Chapters] Fetching:", url);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        Referer: `${BASE_URL}/series/${id}`,
      },
    });

    const $ = cheerio.load(response.data);
    const chapters = [];
    const seenIds = new Set();

    $('a[href*="/chapters/"]').each((i, el) => {
      const $el = $(el);
      const chapterUrl = $el.attr("href") || "";
      const match = chapterUrl.match(/\/chapters\/([^/?#]+)/);
      if (!match) return;

      const chapterId = match[1];
      if (seenIds.has(chapterId)) return;
      seenIds.add(chapterId);

      let label = null;
      $el.find("span").each((j, s) => {
        const $s = $(s);
        const cls = $s.attr("class") || "";
        if (!$s.find("svg").length && !cls.includes("link-info")) {
          const text = $s.text().trim();
          if (text && !label) label = text;
        }
      });

      let number = null;
      if (label) {
        const numMatch = label.match(/(\d+(?:\.\d+)?)/);
        if (numMatch) number = parseFloat(numMatch[1]);
      }

      const $time = $el.find("time");
      const uploadedAt = $time.attr("datetime") || null;
      const uploadedAtDisplay = $time.text().trim() || null;

      chapters.push({
        id: chapterId,
        number,
        label,
        url: chapterUrl,
        uploadedAt,
        uploadedAtDisplay,
      });
    });

    res.json({
      id,
      total: chapters.length,
      chapters,
    });
  } catch (error) {
    console.error("[WeebCentral Chapters] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch chapters",
      message: error.message,
    });
  }
});

module.exports = router;
