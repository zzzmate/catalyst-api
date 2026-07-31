const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const BASE_URL = "https://mangapill.com";
const configPath = path.join(__dirname, "..", "..", "config.json");
const cacheDir = path.join(
  __dirname,
  "..",
  "..",
  "cache",
  "mangapill",
  "trending",
);

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getCachePath() {
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, "data.json");
}

function isCacheValid() {
  const config = getConfig();
  const { cacheMinutes, lastCached } = config.mangapill.caching.trending;
  if (!lastCached || !fs.existsSync(getCachePath())) return false;
  const diff = (Date.now() - new Date(lastCached).getTime()) / 1000 / 60;
  return diff < cacheMinutes;
}

function getCachedData() {
  if (!fs.existsSync(getCachePath())) return null;
  return JSON.parse(fs.readFileSync(getCachePath(), "utf-8"));
}

function saveCachedData(data) {
  fs.writeFileSync(getCachePath(), JSON.stringify(data, null, 2));
}

function updateLastCached() {
  const config = getConfig();
  config.mangapill.caching.trending.lastCached = new Date().toISOString();
  saveConfig(config);
}

router.get("/", async (req, res) => {
  if (isCacheValid()) {
    const cached = getCachedData();
    if (cached) return res.json({ cached: true, ...cached });
  }

  try {
    const response = await axios.get(BASE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });

    const $ = cheerio.load(response.data);
    const items = [];

    const $trendingSection = $("h4")
      .filter((i, el) => $(el).text().trim() === "Trending Mangas")
      .first();
    const $grid = $trendingSection.parent().next(".grid");

    $grid.find("> div").each((i, el) => {
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

      const tags = [];
      $el.find(".text-xs.leading-5.font-semibold").each((j, tagEl) => {
        tags.push($(tagEl).text().trim());
      });

      const mangaMatch = mangaUrl.match(/\/manga\/(\d+)\/([^/]+)/);

      items.push({
        id: mangaMatch ? mangaMatch[1] : null,
        slug: mangaMatch ? mangaMatch[2] : null,
        title,
        altTitle: altTitle || null,
        url: mangaUrl ? BASE_URL + mangaUrl : null,
        image,
        type: tags[0] || null,
        year: tags[1] || null,
        status: tags[2] || null,
        tags,
      });
    });

    const data = { items, total: items.length };
    saveCachedData(data);
    updateLastCached();

    res.json({ cached: false, ...data });
  } catch (error) {
    console.error("[Mangapill Trending] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch trending mangas",
      message: error.message,
    });
  }
});

module.exports = router;
