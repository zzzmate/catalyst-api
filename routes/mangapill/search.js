const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const BASE_URL = "https://mangapill.com";
const SEARCH_URL = "https://mangapill.com/search";
const configPath = path.join(__dirname, "..", "..", "config.json");
const cacheDir = path.join(
  __dirname,
  "..",
  "..",
  "cache",
  "mangapill",
  "search",
);

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function buildCacheKey(params) {
  const parts = [];
  if (params.q) parts.push(`q_${params.q}`);
  if (params.type) parts.push(`t_${params.type}`);
  if (params.status) parts.push(`s_${params.status}`);
  if (params.genres && params.genres.length)
    parts.push(`g_${params.genres.sort().join("-")}`);
  return parts.length
    ? parts.join("__").replace(/[^a-zA-Z0-9_-]/g, "_")
    : "default";
}

function getCachePath(key) {
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, `${key}.json`);
}

function isCacheValid(key) {
  const config = getConfig();
  const { cacheMinutes, cached } = config.mangapill.caching.search;
  if (!cached[key] || !fs.existsSync(getCachePath(key))) return false;
  const diff = (Date.now() - new Date(cached[key]).getTime()) / 1000 / 60;
  return diff < cacheMinutes;
}

function getCachedData(key) {
  const filePath = getCachePath(key);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveCachedData(key, data) {
  fs.writeFileSync(getCachePath(key), JSON.stringify(data, null, 2));
}

function updateLastCached(key) {
  const config = getConfig();
  config.mangapill.caching.search.cached[key] = new Date().toISOString();
  saveConfig(config);
}

router.get("/", async (req, res) => {
  const { q, type, status, genre } = req.query;

  const genres = genre
    ? Array.isArray(genre)
      ? genre
      : genre.split(",").map((g) => g.trim())
    : [];

  const params = { q, type, status, genres };
  const cacheKey = buildCacheKey(params);

  if (isCacheValid(cacheKey)) {
    const cached = getCachedData(cacheKey);
    if (cached) return res.json({ cached: true, ...cached });
  }

  try {
    const query = new URLSearchParams();
    if (q) query.append("q", q);
    if (type) query.append("type", type);
    if (status) query.append("status", status);
    genres.forEach((g) => query.append("genre", g));

    const fullUrl = `${SEARCH_URL}?${query.toString()}`;

    const response = await axios.get(fullUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });

    const $ = cheerio.load(response.data);
    const items = [];

    const $resultsGrid = $(".container.py-3 > .my-3.grid").last();

    $resultsGrid.find("> div").each((i, el) => {
      const $el = $(el);
      const link = $el.find("a").first();
      const mangaUrl = link.attr("href") || "";
      const image =
        $el.find("img").attr("data-src") || $el.find("img").attr("src") || "";
      const title = $el.find(".font-black.leading-tight").text().trim();
      const altTitle = $el
        .find(".line-clamp-2.text-xs.text-secondary")
        .text()
        .trim();

      const metaTags = [];
      $el.find(".text-xs.leading-5").each((j, tagEl) => {
        const $tag = $(tagEl);
        if (
          $tag.hasClass("bg-purple-500") ||
          $tag.hasClass("bg-orange-500") ||
          $tag.hasClass("bg-green-500") ||
          $tag.hasClass("bg-red-500") ||
          $tag.hasClass("bg-yellow-500") ||
          $tag.hasClass("bg-blue-500")
        ) {
          metaTags.push($tag.text().trim());
        }
      });

      const genreTags = [];
      $el.find(".text-xs.leading-5.bg-card").each((j, tagEl) => {
        genreTags.push($(tagEl).text().trim());
      });

      const mangaMatch = mangaUrl.match(/\/manga\/(\d+)\/([^/]+)/);

      items.push({
        id: mangaMatch ? mangaMatch[1] : null,
        slug: mangaMatch ? mangaMatch[2] : null,
        title,
        altTitle: altTitle || null,
        url: mangaUrl ? BASE_URL + mangaUrl : null,
        image,
        type: metaTags[0] || null,
        year: metaTags[1] || null,
        status: metaTags[2] || null,
        genres: genreTags,
      });
    });

    const data = {
      query: {
        q: q || null,
        type: type || null,
        status: status || null,
        genres,
      },
      items,
      total: items.length,
    };

    saveCachedData(cacheKey, data);
    updateLastCached(cacheKey);

    res.json({ cached: false, ...data });
  } catch (error) {
    console.error("[Mangapill Search] Error:", error.message);
    res.status(500).json({
      error: "Failed to search mangas",
      message: error.message,
    });
  }
});

module.exports = router;
