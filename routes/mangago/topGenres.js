const express = require("express");
const cheerio = require("cheerio");
const router = express.Router();
const {
  BASE_URL,
  extractSlug,
  absoluteUrl,
  fetchPage,
  isCacheValid,
  getCachedData,
  saveCachedData,
} = require("./utils");

router.get("/", async (req, res) => {
  const genreFilter = (req.query.genre || "").trim().toLowerCase();

  if (isCacheValid("top_genres", "default")) {
    const cached = getCachedData("top_genres", "default");
    if (cached) {
      let filtered = cached.genres;
      if (genreFilter)
        filtered = cached.genres.filter(
          (g) => g.genre.toLowerCase() === genreFilter,
        );
      return res.json({
        cached: true,
        genres: filtered,
        totalGenres: filtered.length,
      });
    }
  }

  try {
    console.log("[Mangago Top Genres] Fetching:", BASE_URL);
    const html = await fetchPage(BASE_URL);
    const $ = cheerio.load(html);
    const genres = [];

    $("#top_genres > ul").each((i, el) => {
      const $ul = $(el);
      const $titleLi = $ul.find("li.li_title").first();
      if (!$titleLi.length) return;
      const $genreLink = $titleLi.find("a").first();
      const genreName = ($genreLink.attr("title") || "")
        .replace(/\s*manga$/i, "")
        .trim();
      const genreUrl = $genreLink.attr("href") || "";
      if (!genreName) return;

      const items = [];
      const seenSlugs = new Set();
      $ul.find(".listitem").each((j, item) => {
        const $item = $(item);
        const $mainLink = $item.find(".left a").first();
        const mangaUrl = $mainLink.attr("href") || "";
        const slug = extractSlug(mangaUrl);
        if (!slug || seenSlugs.has(slug)) return;
        seenSlugs.add(slug);

        const $img = $item.find("img").first();
        const cover = $img.attr("data-src") || $img.attr("src") || null;
        const $titleLink = $item.find(".title a").first();
        const title = $titleLink.attr("title") || $titleLink.text().trim();
        const isHot = ($mainLink.attr("style") || "").includes("FEFD7F");
        const titleStyle = $titleLink.attr("style") || "";
        const isCompleted = titleStyle.includes("manga_closed");

        items.push({
          slug,
          title,
          url: absoluteUrl(mangaUrl),
          cover,
          isHot,
          isCompleted,
        });
      });

      genres.push({
        genre: genreName,
        genreUrl: absoluteUrl(genreUrl),
        items,
        total: items.length,
      });
    });

    const data = { genres, totalGenres: genres.length };
    saveCachedData("top_genres", "default", data);

    let filtered = genres;
    if (genreFilter)
      filtered = genres.filter((g) => g.genre.toLowerCase() === genreFilter);
    res.json({ cached: false, genres: filtered, totalGenres: filtered.length });
  } catch (error) {
    console.error("[Mangago Top Genres] Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch top genres", message: error.message });
  }
});

module.exports = router;
