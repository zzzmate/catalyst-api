const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

const BASE_URL = "https://mangadot.net";
const SEARCH_URL = "https://mangadot.net/search";

const SORT_VALUES = [
  "relevance",
  "latest",
  "alphabetical",
  "chapters",
  "views",
  "tracked",
  "rating",
];
const STATUS_VALUES = ["Ongoing", "Completed", "Hiatus"];
const VOLUMES_VALUES = ["with", "without"];
const ORIGIN_VALUES = ["JP", "KR", "CN", "ONESHOT"];

const ORIGIN_ALIAS = {
  manga: "JP",
  manhwa: "KR",
  manhua: "CN",
  oneshot: "ONESHOT",
  "one-shot": "ONESHOT",
};

function normalizeOrigins(input) {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : String(input).split(",");
  const result = [];
  arr.forEach((v) => {
    const trimmed = String(v).trim();
    if (!trimmed) return;
    const upper = trimmed.toUpperCase();
    const lower = trimmed.toLowerCase();
    if (ORIGIN_VALUES.includes(upper)) result.push(upper);
    else if (ORIGIN_ALIAS[lower]) result.push(ORIGIN_ALIAS[lower]);
  });
  return [...new Set(result)];
}

function normalizeFilters(input) {
  const include = [];
  const exclude = [];
  if (!input) return { include, exclude };

  const arr = Array.isArray(input) ? input : String(input).split(",");
  arr.forEach((item) => {
    const trimmed = String(item).trim();
    if (!trimmed) return;

    if (trimmed.startsWith("-")) {
      const val = trimmed.substring(1).trim();
      if (val) exclude.push(val);
    } else {
      include.push(trimmed);
    }
  });

  return {
    include: [...new Set(include)],
    exclude: [...new Set(exclude)],
  };
}

router.get("/", async (req, res) => {
  const search = (req.query.search || req.query.q || "").trim();
  const sortBy = SORT_VALUES.includes(req.query.sortBy)
    ? req.query.sortBy
    : search
      ? "relevance"
      : "latest";
  const status = STATUS_VALUES.includes(req.query.status)
    ? req.query.status
    : null;
  const volumes = VOLUMES_VALUES.includes(req.query.volumes)
    ? req.query.volumes
    : null;
  const page = parseInt(req.query.page) || 1;
  const origin = normalizeOrigins(req.query.origin);

  const genreData = normalizeFilters(req.query.genre);
  const tagData = normalizeFilters(req.query.tag);

  const author = (req.query.author || "").trim();
  const artist = (req.query.artist || "").trim();

  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    if (volumes) params.append("volumes", volumes);
    if (author) params.append("author", author);
    if (artist) params.append("artist", artist);
    origin.forEach((o) => params.append("origin", o));

    genreData.include.forEach((g) => params.append("genre", g));
    genreData.exclude.forEach((g) => {
      params.append("genre", `-${g}`);
      params.append("excludeGenre", g);
    });

    tagData.include.forEach((t) => params.append("tag", t));
    tagData.exclude.forEach((t) => {
      params.append("tag", `-${t}`);
      params.append("excludeTag", t);
    });

    params.append("sortBy", sortBy);
    params.append("page", page);

    const fullUrl = `${SEARCH_URL}?${params.toString()}`;
    console.log("[MangaDotNet Browse] Fetching:", fullUrl);

    const response = await axios.get(fullUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });

    const $ = cheerio.load(response.data);
    const items = [];

    $('a[href^="/manga/"]').each((i, el) => {
      const $el = $(el);
      const href = $el.attr("href") || "";
      const mangaMatch = href.match(/^\/manga\/(\d+)$/);
      if (!mangaMatch) return;

      const $img = $el.find("img").first();
      const image = $img.attr("src") || null;
      const type = $el.find("span.uppercase").first().text().trim() || null;
      const ratingText = $el.find(".text-\\[\\#fbbf24\\]").text().trim();
      const rating = ratingText
        ? parseFloat(ratingText.replace("★", "").trim())
        : null;
      const chapterText = $el.find("span.text-white").last().text().trim();
      const latestChapter =
        chapterText && chapterText.startsWith("Ch")
          ? chapterText.replace(/^Ch\s*/i, "").trim()
          : null;
      const title = $el.find(".line-clamp-2").last().text().trim();

      if (items.some((it) => it.id === mangaMatch[1])) return;

      items.push({
        id: mangaMatch[1],
        title,
        url: BASE_URL + href,
        image: image
          ? image.startsWith("http")
            ? image
            : BASE_URL + image
          : null,
        type,
        rating,
        latestChapter,
      });
    });

    let totalResults = null;
    const totalMatch = response.data.match(
      /<span[^>]*>(\d+)\s*<\/span>\s*<span[^>]*>\s*matches\s*<\/span>/i,
    );
    if (totalMatch) totalResults = parseInt(totalMatch[1]);
    if (totalResults === null) {
      const altMatch = response.data.match(
        />(\d+)\s*<\/span>\s*<span[^>]*>\s*results\s*</i,
      );
      if (altMatch) totalResults = parseInt(altMatch[1]);
    }

    let hasNextPage = false;
    let lastPage = page;
    $('nav[aria-label="Pagination"] button').each((i, el) => {
      const txt = $(el).text().trim();
      const num = parseInt(txt);
      if (!isNaN(num) && num > lastPage) lastPage = num;
    });
    const $nextBtn = $(
      'nav[aria-label="Pagination"] button[aria-label="Next page"]',
    );
    if (
      $nextBtn.length &&
      !$nextBtn.is("[disabled]") &&
      !$nextBtn.attr("class")?.includes("pointer-events-none")
    ) {
      hasNextPage = true;
    }
    if (totalResults !== null) {
      const estimatedLastPage = Math.ceil(totalResults / 28);
      if (estimatedLastPage > lastPage) lastPage = estimatedLastPage;
      hasNextPage = page < estimatedLastPage;
    }

    res.json({
      query: {
        search: search || null,
        sortBy,
        status,
        volumes,
        origin,
        genre: genreData.include,
        excludeGenre: genreData.exclude,
        tag: tagData.include,
        excludeTag: tagData.exclude,
        author: author || null,
        artist: artist || null,
        page,
      },
      items,
      total: items.length,
      totalResults,
      pagination: {
        currentPage: page,
        lastPage,
        hasNextPage,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[MangaDotNet Browse] Error:", error.message);
    res.status(500).json({
      error: "Failed to browse",
      message: error.message,
    });
  }
});

module.exports = router;
