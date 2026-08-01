const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

const BASE_URL = "https://weebcentral.com";

router.get("/", async (req, res) => {
  try {
    console.log("[WeebCentral Recommendations] Fetching:", BASE_URL);

    const response = await axios.get(BASE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });

    const $ = cheerio.load(response.data);
    const items = [];
    const seenIds = new Set();

    let $section = $("h2")
      .filter((i, el) => {
        return $(el).text().trim().includes("Recommendations");
      })
      .parent();

    if (!$section.length) {
      $section = $("section").filter((i, el) => {
        return (
          $(el).find(".glide").length > 0 &&
          $(el).find("h2").text().includes("Recommendations")
        );
      });
    }

    $section.find(".glide__slide").each((i, el) => {
      const $el = $(el);

      if ($el.hasClass("glide__slide--clone")) return;

      const $a = $el.find("a").first();
      const url = $a.attr("href") || "";
      const seriesMatch = url.match(/\/series\/([^/]+)\/([^/?#]+)/);
      if (!seriesMatch) return;

      const id = seriesMatch[1];
      if (seenIds.has(id)) return;
      seenIds.add(id);

      const slug = seriesMatch[2];
      const $img = $el.find("img").first();
      const title =
        ($img.attr("alt") || "").replace(/\s+cover$/i, "").trim() || null;
      const image = $img.attr("src") || null;

      let normalImage = null;
      let smallImage = null;
      $el.find("source").each((j, s) => {
        const srcset = $(s).attr("srcset");
        const media = $(s).attr("media") || "";
        if (!srcset) return;
        const src = srcset.split(" ")[0];
        if (media.includes("768px")) normalImage = src;
        else if (!smallImage) smallImage = src;
      });

      items.push({
        id,
        slug,
        title,
        url,
        cover: {
          fallback: image,
          small: smallImage,
          normal: normalImage,
        },
      });
    });

    res.json({
      items,
      total: items.length,
    });
  } catch (error) {
    console.error("[WeebCentral Recommendations] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch recommendations",
      message: error.message,
    });
  }
});

module.exports = router;
