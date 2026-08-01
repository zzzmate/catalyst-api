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
  if (isCacheValid("popular", "default")) {
    const cached = getCachedData("popular", "default");
    if (cached) return res.json({ cached: true, ...cached });
  }

  try {
    console.log("[Mangago Popular] Fetching:", BASE_URL);
    const html = await fetchPage(BASE_URL);
    const $ = cheerio.load(html);
    const items = [];
    const seenSlugs = new Set();

    $("#toplist_panel li.toplist").each((i, el) => {
      const $el = $(el);
      const $img = $el.find("img").first();
      const cover = $img.attr("data-src") || $img.attr("src") || null;
      const $titleLink = $el.find(".updates_chapter h3 a").first();
      const title = $titleLink.text().trim();
      const mangaUrl = $titleLink.attr("href") || "";
      const slug = extractSlug(mangaUrl);
      if (!slug || seenSlugs.has(slug)) return;
      seenSlugs.add(slug);

      const isHot = $titleLink.attr("style")?.includes("FEFD7F") || false;
      const chapters = [];
      $el.find(".updates_chapter ul li").each((j, li) => {
        const $li = $(li);
        if ($li.find("h3").length > 0) return;
        const $a = $li.find("a").first();
        const url = $a.attr("href") || "";
        const label = $a.text().trim();
        const id = extractChapterId(url);
        if (id) chapters.push({ id, label, url: absoluteUrl(url) });
      });

      items.push({
        slug,
        title,
        url: absoluteUrl(mangaUrl),
        cover,
        isHot,
        latestChapters: chapters,
      });
    });

    const data = { items, total: items.length };
    saveCachedData("popular", "default", data);
    res.json({ cached: false, ...data });
  } catch (error) {
    console.error("[Mangago Popular] Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch popular", message: error.message });
  }
});

module.exports = router;
