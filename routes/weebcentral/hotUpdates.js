const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

const BASE_URL = "https://weebcentral.com";

router.get("/", async (req, res) => {
  try {
    const url = `${BASE_URL}/hot-updates`;
    console.log("[WeebCentral Hot Updates] Fetching:", url);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });

    const $ = cheerio.load(response.data);
    const items = [];
    const seenChapters = new Set();

    $("article.md\\:hidden").each((i, el) => {
      const $el = $(el);
      const title = $el.attr("data-tip") || null;

      const seriesAnchor = $el.find('a[href*="/series/"]').first();
      const seriesUrl = seriesAnchor.attr("href") || "";
      const seriesMatch = seriesUrl.match(/\/series\/([^/]+)\/([^/?#]+)/);
      const seriesId = seriesMatch ? seriesMatch[1] : null;
      const seriesSlug = seriesMatch ? seriesMatch[2] : null;

      const chapterAnchor = $el.find('a[href*="/chapters/"]').first();
      const chapterUrl = chapterAnchor.attr("href") || "";
      const chapterMatch = chapterUrl.match(/\/chapters\/([^/?#]+)/);
      const chapterId = chapterMatch ? chapterMatch[1] : null;

      if (!chapterId || seenChapters.has(chapterId)) return;
      seenChapters.add(chapterId);

      const chapterLabel =
        chapterAnchor.find("span").first().text().trim() || null;
      const dateTime = chapterAnchor.find("time").attr("datetime") || null;
      const dateDisplay = chapterAnchor.find("time").text().trim() || null;

      const $img = $el.find("img").first();
      let image = $img.attr("src") || null;

      let sourceImage = null;
      $el.find("source").each((j, s) => {
        const srcset = $(s).attr("srcset");
        if (srcset && !sourceImage) sourceImage = srcset.split(" ")[0];
      });

      items.push({
        title,
        series: {
          id: seriesId,
          slug: seriesSlug,
          url: seriesUrl || null,
        },
        chapter: {
          id: chapterId,
          label: chapterLabel,
          url: chapterUrl || null,
          uploadedAt: dateTime,
          uploadedAtDisplay: dateDisplay,
        },
        cover: {
          small: image,
          webp: sourceImage,
        },
      });
    });

    if (items.length === 0) {
      $("article.md\\:relative").each((i, el) => {
        const $el = $(el);
        const title = $el.attr("data-tip") || null;

        const chapterAnchor = $el.find('a[href*="/chapters/"]').first();
        const chapterUrl = chapterAnchor.attr("href") || "";
        const chapterMatch = chapterUrl.match(/\/chapters\/([^/?#]+)/);
        const chapterId = chapterMatch ? chapterMatch[1] : null;

        if (!chapterId || seenChapters.has(chapterId)) return;
        seenChapters.add(chapterId);

        const labelDivs = $el
          .find(".absolute div")
          .map((k, d) => $(d).text().trim())
          .get();
        const chapterLabel = labelDivs.length > 1 ? labelDivs[1] : null;

        const $img = $el.find("img").first();
        const image = $img.attr("src") || null;

        let sourceImage = null;
        $el.find("source").each((j, s) => {
          const srcset = $(s).attr("srcset");
          if (srcset && !sourceImage) sourceImage = srcset.split(" ")[0];
        });

        items.push({
          title,
          series: { id: null, slug: null, url: null },
          chapter: {
            id: chapterId,
            label: chapterLabel,
            url: chapterUrl || null,
            uploadedAt: null,
            uploadedAtDisplay: null,
          },
          cover: {
            small: image,
            webp: sourceImage,
          },
        });
      });
    }

    res.json({
      items,
      total: items.length,
    });
  } catch (error) {
    console.error("[WeebCentral Hot Updates] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch hot updates",
      message: error.message,
    });
  }
});

module.exports = router;
