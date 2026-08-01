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
  if (isCacheValid("new_chapters", "default")) {
    const cached = getCachedData("new_chapters", "default");
    if (cached) return res.json({ cached: true, ...cached });
  }

  try {
    console.log("[Mangago New Chapters] Fetching:", BASE_URL);
    const html = await fetchPage(BASE_URL);
    const $ = cheerio.load(html);
    const items = [];

    $("#new_chapter li.updatesli").each((i, el) => {
      const $el = $(el);
      const $mangaLink = $el.find("span").first().find("a").first();
      const $img = $mangaLink.find("img").first();
      const cover = $img.attr("data-src") || $img.attr("src") || null;
      const mangaUrl = $mangaLink.attr("href") || "";
      const slug = extractSlug(mangaUrl);

      const $titleWrapper = $el.find(".newchapter_title").first();
      const title =
        $titleWrapper.find("h3 a").first().text().trim() ||
        $img.attr("title") ||
        null;
      const $chapterLink = $titleWrapper.find("a").eq(1);
      const chapterUrl = $chapterLink.attr("href") || "";
      const chapterLabel = $chapterLink.text().trim();
      const chapterId = extractChapterId(chapterUrl);
      const wrapperText = $titleWrapper.text();
      const dateMatch = wrapperText.match(/(\d{2}-\d{2})/);
      const uploadedAt = dateMatch ? dateMatch[1] : null;
      const isNew = $titleWrapper
        .find("strong")
        .text()
        .trim()
        .toLowerCase()
        .includes("new");

      if (!slug) return;

      items.push({
        slug,
        title,
        url: absoluteUrl(mangaUrl),
        cover,
        isNew,
        latestChapter: {
          id: chapterId,
          label: chapterLabel,
          url: absoluteUrl(chapterUrl),
          uploadedAt,
        },
      });
    });

    const data = { items, total: items.length };
    saveCachedData("new_chapters", "default", data);
    res.json({ cached: false, ...data });
  } catch (error) {
    console.error("[Mangago New Chapters] Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch new chapters", message: error.message });
  }
});

module.exports = router;
