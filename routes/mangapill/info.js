const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const BASE_URL = "https://mangapill.com";
const configPath = path.join(__dirname, "..", "..", "config.json");
const cacheDir = path.join(__dirname, "..", "..", "cache", "mangapill", "info");

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getCacheKey(id, slug) {
  return `${id}_${slug}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getCachePath(key) {
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, `${key}.json`);
}

function isCacheValid(key) {
  const config = getConfig();
  const { cacheMinutes, cached } = config.mangapill.caching.info;
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
  config.mangapill.caching.info.cached[key] = new Date().toISOString();
  saveConfig(config);
}

router.get("/:id/:slug", async (req, res) => {
  const { id, slug } = req.params;
  const cacheKey = getCacheKey(id, slug);

  if (isCacheValid(cacheKey)) {
    const cached = getCachedData(cacheKey);
    if (cached) return res.json({ cached: true, ...cached });
  }

  try {
    const url = `${BASE_URL}/manga/${id}/${slug}`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });

    const $ = cheerio.load(response.data);

    const title = $("h1").first().text().trim();

    let altTitle = null;
    const $altTitleLabel = $("label")
      .filter(
        (i, el) => $(el).text().trim().toLowerCase() === "alternative titles",
      )
      .first();
    if ($altTitleLabel.length) {
      altTitle = $altTitleLabel.next().text().trim() || null;
    }

    const image =
      $("img.lazy").first().attr("data-src") ||
      $("img.lazy").first().attr("src") ||
      $("img").first().attr("src") ||
      null;

    let description = null;
    const $descLabel = $("label")
      .filter((i, el) => $(el).text().trim().toLowerCase() === "description")
      .first();
    if ($descLabel.length) {
      description = $descLabel.next().text().trim() || null;
    }
    if (!description) {
      description =
        $("p")
          .filter((i, el) => $(el).text().trim().length > 50)
          .first()
          .text()
          .trim() || null;
    }

    let type = null;
    let year = null;
    let status = null;
    let rating = null;

    $("label").each((i, el) => {
      const label = $(el).text().trim().toLowerCase();
      const value = $(el).next().text().trim();

      if (label === "type") type = value.toLowerCase() || null;
      else if (label === "year") year = value || null;
      else if (label === "status") status = value.toLowerCase() || null;
      else if (label === "rating" || label === "score") rating = value || null;
    });

    const genres = [];
    const $genresLabel = $("label")
      .filter((i, el) => $(el).text().trim().toLowerCase() === "genres")
      .first();
    if ($genresLabel.length) {
      $genresLabel
        .next()
        .find("a")
        .each((i, el) => {
          genres.push($(el).text().trim());
        });
      if (genres.length === 0) {
        $genresLabel
          .parent()
          .find("a")
          .each((i, el) => {
            const text = $(el).text().trim();
            if (text) genres.push(text);
          });
      }
    }

    const chapters = [];
    $("#chapters a").each((i, el) => {
      const $a = $(el);
      const href = $a.attr("href") || "";
      const chapterText = $a.text().trim();
      const chapterTitle = $a.attr("title") || "";
      const numberMatch = chapterText.match(/(\d+(?:\.\d+)?)/);
      const idMatch = href.match(/\/chapters\/(\d+)-(\d+)\//);

      chapters.push({
        id: idMatch ? idMatch[2] : null,
        mangaId: idMatch ? idMatch[1] : null,
        number: numberMatch ? numberMatch[1] : null,
        name: chapterText,
        title: chapterTitle,
        url: href ? BASE_URL + href : null,
      });
    });

    const data = {
      data: {
        id,
        slug,
        title,
        altTitle,
        url: url,
        image,
        description,
        type,
        year,
        status,
        rating,
        genres,
        chapters,
        totalChapters: chapters.length,
      },
    };

    saveCachedData(cacheKey, data);
    updateLastCached(cacheKey);

    res.json({ cached: false, ...data });
  } catch (error) {
    console.error("[Mangapill Info] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch manga info",
      message: error.message,
    });
  }
});

module.exports = router;
