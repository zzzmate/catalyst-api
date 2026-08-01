const express = require("express");
const cheerio = require("cheerio");
const router = express.Router();
const {
  BASE_URL,
  extractSlug,
  extractChapterId,
  absoluteUrl,
  fetchPage,
  isCacheValid,
  getCachedData,
  saveCachedData,
} = require("./utils");

router.get("/", async (req, res) => {
  if (isCacheValid("featured", "default")) {
    const cached = getCachedData("featured", "default");
    if (cached) return res.json({ cached: true, ...cached });
  }

  try {
    console.log("[Mangago Featured] Fetching:", BASE_URL);
    const html = await fetchPage(BASE_URL);
    const $ = cheerio.load(html);
    const items = [];
    const seenSlugs = new Set();

    $(".index_recommend > li.left").each((i, el) => {
      const $el = $(el);
      const $titleLink = $el.find("a.title").first();
      const title = $titleLink.text().trim();
      const mangaUrl = $titleLink.attr("href") || "";
      const slug = extractSlug(mangaUrl);
      if (!slug || seenSlugs.has(slug)) return;
      seenSlugs.add(slug);

      const $chapterLink = $el.find(".rname_wrapper a").last();
      const chapterUrl = $chapterLink.attr("href") || "";
      const chapterLabel = $chapterLink.text().trim();
      const chapterId = extractChapterId(chapterUrl);

      const $img = $el.find("img").first();
      const cover = $img.attr("data-src") || $img.attr("src") || null;
      const isHot = $el.find('.rname[style*="14D427"]').length > 0;

      items.push({
        slug,
        title,
        url: absoluteUrl(mangaUrl),
        cover,
        isHot,
        latestChapter: {
          id: chapterId,
          label: chapterLabel,
          url: absoluteUrl(chapterUrl),
        },
      });
    });

    const data = { items, total: items.length };
    saveCachedData("featured", "default", data);
    res.json({ cached: false, ...data });
  } catch (error) {
    console.error("[Mangago Featured] Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch featured", message: error.message });
  }
});

module.exports = router;
