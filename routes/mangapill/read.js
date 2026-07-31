const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const BASE_URL = "https://mangapill.com";
const configPath = path.join(__dirname, "..", "..", "config.json");
const cacheDir = path.join(__dirname, "..", "..", "cache", "mangapill", "read");

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getCacheKey(mangaId, chapterId, slug) {
  return `${mangaId}_${chapterId}_${slug}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getCachePath(key) {
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, `${key}.json`);
}

function isCacheValid(key) {
  const config = getConfig();
  const { cacheMinutes, cached } = config.mangapill.caching.read;
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
  config.mangapill.caching.read.cached[key] = new Date().toISOString();
  saveConfig(config);
}

function proxifyPages(pages, req) {
  const proxyBase = `${req.protocol}://${req.get("host")}/mangapill/proxy`;
  return pages.map((p) => ({
    ...p,
    original_url: p.url,
    url: `${proxyBase}?url=${encodeURIComponent(p.url)}`,
  }));
}

router.get("/:mangaId-:chapterId/:slug", async (req, res) => {
  const { mangaId, chapterId, slug } = req.params;
  const cacheKey = getCacheKey(mangaId, chapterId, slug);

  if (isCacheValid(cacheKey)) {
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json({
        cached: true,
        ...cached,
        data: {
          ...cached.data,
          pages: proxifyPages(cached.data.pages, req),
        },
      });
    }
  }

  try {
    const url = `${BASE_URL}/chapters/${mangaId}-${chapterId}/${slug}`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });

    const $ = cheerio.load(response.data);

    const pages = [];
    $("chapter-page img.js-page").each((i, el) => {
      const $img = $(el);
      const imgUrl = $img.attr("data-src") || $img.attr("src") || "";
      const alt = $img.attr("alt") || "";
      const width = parseInt($img.attr("width")) || null;
      const height = parseInt($img.attr("height")) || null;

      if (imgUrl) {
        pages.push({
          page: i + 1,
          url: imgUrl,
          width,
          height,
          alt,
        });
      }
    });

    const title = $("h1").first().text().trim() || null;
    const chapterNumberMatch = slug.match(/chapter-(\d+(?:\.\d+)?)/);
    const chapterNumber = chapterNumberMatch ? chapterNumberMatch[1] : null;

    const data = {
      data: {
        chapterId,
        mangaId,
        slug,
        number: chapterNumber,
        title,
        url,
        totalPages: pages.length,
        pages,
      },
    };

    saveCachedData(cacheKey, data);
    updateLastCached(cacheKey);

    res.json({
      cached: false,
      ...data,
      data: {
        ...data.data,
        pages: proxifyPages(data.data.pages, req),
      },
    });
  } catch (error) {
    console.error("[Mangapill Read] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch chapter pages",
      message: error.message,
    });
  }
});

module.exports = router;
