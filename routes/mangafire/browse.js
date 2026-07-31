const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const router = express.Router();

puppeteer.use(StealthPlugin());

const configPath = path.join(__dirname, "..", "..", "config.json");
const cacheDir = path.join(
  __dirname,
  "..",
  "..",
  "cache",
  "mangafire",
  "browse",
);

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getCacheKey(sort, page, limit, extras) {
  return `${sort}_p${page}_l${limit}_${extras}`;
}

function getCachePath(key) {
  return path.join(cacheDir, `${key}.json`);
}

function isCacheValid(key) {
  const config = getConfig();
  const { cacheMinutes, cached } = config.mangafire.caching.browse;
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
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(getCachePath(key), JSON.stringify(data, null, 2));
}

function updateLastCached(key) {
  const config = getConfig();
  config.mangafire.caching.browse.cached[key] = new Date().toISOString();
  saveConfig(config);
}

function resolveGenreIds(names, genreConfig) {
  if (!names) return [];
  return names
    .split(",")
    .map((n) => genreConfig[n.trim()])
    .filter(Boolean);
}

function resolveDemoIds(names, demoConfig) {
  if (!names) return [];
  return names
    .split(",")
    .map((n) => demoConfig[n.trim()])
    .filter(Boolean);
}

function resolveThemeIds(names, themeConfig) {
  if (!names) return [];
  return names
    .split(",")
    .map((n) => themeConfig[n.trim()])
    .filter(Boolean);
}

function buildBrowseUrl(sortKey, queryParams) {
  const config = getConfig();
  const sortMap = config.mangafire.filters.sort;

  let url = "https://mangafire.to/browse";
  const params = [];

  const sortValue = sortMap[sortKey];
  if (sortValue) {
    params.push(`sort=${encodeURIComponent(sortValue)}`);
  }

  const {
    genres,
    genres_exclude,
    demographics,
    themes,
    types,
    content_rating,
    languages,
    statuses,
    year_from,
    year_to,
    min_chap,
    keyword,
    page,
  } = queryParams;

  if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);

  if (types) {
    const typeConfig = config.mangafire.filters.types;
    const typeNames = types.split(",");
    const vals = typeNames.map((n) => {
      const trimmed = n.trim();
      return typeConfig[trimmed] || trimmed;
    });
    params.push(`types=${encodeURIComponent(vals.join(","))}`);
  }

  if (content_rating) {
    const crConfig = config.mangafire.filters.content_rating;
    const crNames = content_rating.split(",");
    const vals = crNames.map((n) => {
      const trimmed = n.trim();
      return crConfig[trimmed] || trimmed;
    });
    params.push(`content_rating=${encodeURIComponent(vals.join(","))}`);
  }

  if (genres) {
    const ids = resolveGenreIds(genres, config.mangafire.genres);
    if (ids.length) params.push(`genres_in=${ids.join(",")}`);
  }

  if (genres_exclude) {
    const ids = resolveGenreIds(genres_exclude, config.mangafire.genres);
    if (ids.length) params.push(`genres_ex=${ids.join(",")}`);
  }

  if (demographics) {
    const ids = resolveDemoIds(demographics, config.mangafire.demographics);
    if (ids.length) params.push(`demographics=${ids.join(",")}`);
  }

  if (themes) {
    const ids = resolveThemeIds(themes, config.mangafire.themes);
    if (ids.length) params.push(`theme_ids=${ids.join(",")}`);
  }

  if (languages) {
    const langConfig = config.mangafire.filters.languages;
    const langNames = languages.split(",");
    const vals = langNames.map((n) => {
      const trimmed = n.trim();
      return langConfig[trimmed] || trimmed;
    });
    params.push(`languages=${encodeURIComponent(vals.join(","))}`);
  }

  if (statuses) {
    const statusConfig = config.mangafire.filters.statuses;
    const statusNames = statuses.split(",");
    const vals = statusNames.map((n) => {
      const trimmed = n.trim();
      return statusConfig[trimmed] || trimmed;
    });
    params.push(`statuses=${encodeURIComponent(vals.join(","))}`);
  }

  if (year_from) params.push(`year_from=${year_from}`);
  if (year_to) params.push(`year_to=${year_to}`);
  if (min_chap) params.push(`min_chap=${min_chap}`);
  if (page && page > 1) params.push(`page=${page}`);

  if (params.length) {
    url += "?" + params.join("&");
  }

  return url;
}

async function handleBrowse(req, res, sortKey) {
  const config = getConfig();
  const sortMap = config.mangafire.filters.sort;

  const { page = 1, limit = 30 } = req.query;
  const {
    genres,
    genres_exclude,
    demographics,
    themes,
    types,
    content_rating,
    languages,
    statuses,
    year_from,
    year_to,
    min_chap,
    keyword,
  } = req.query;

  if (!sortMap.hasOwnProperty(sortKey)) {
    return res.status(400).json({
      error: "Invalid sort option",
      available: Object.keys(sortMap),
    });
  }

  let extraParts = [];
  if (genres) extraParts.push(`g${genres}`);
  if (genres_exclude) extraParts.push(`gx${genres_exclude}`);
  if (demographics) extraParts.push(`d${demographics}`);
  if (themes) extraParts.push(`t${themes}`);
  if (types) extraParts.push(`ty${types}`);
  if (content_rating) extraParts.push(`cr${content_rating}`);
  if (languages) extraParts.push(`la${languages}`);
  if (statuses) extraParts.push(`st${statuses}`);
  if (year_from) extraParts.push(`yf${year_from}`);
  if (year_to) extraParts.push(`yt${year_to}`);
  if (min_chap) extraParts.push(`mc${min_chap}`);
  if (keyword) extraParts.push(`kw${keyword}`);
  const extrasStr = extraParts.length > 0 ? extraParts.join("_") : "default";

  const cacheKey = getCacheKey(sortKey, page, limit, extrasStr);

  if (isCacheValid(cacheKey)) {
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json({ cached: true, ...cached });
    }
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const browserPage = await browser.newPage();
    let apiData = null;

    await browserPage.setRequestInterception(true);

    browserPage.on("request", (request) => {
      request.continue();
    });

    browserPage.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/api/titles") && url.includes("vrf=")) {
        try {
          apiData = await response.json();
        } catch (e) {}
      }
    });

    const browseUrl = buildBrowseUrl(sortKey, req.query);
    console.log("[Browse] Navigating to:", browseUrl);

    await browserPage.goto(browseUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));

    if (!apiData) {
      await browserPage.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    await browser.close();

    if (apiData) {
      saveCachedData(cacheKey, apiData);
      updateLastCached(cacheKey);
      res.json({ cached: false, ...apiData });
    } else {
      res.status(500).json({ error: "Could not capture browse data" });
    }
  } catch (error) {
    if (browser) await browser.close();
    console.error("[Browse] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch browse data",
      message: error.message,
    });
  }
}

router.get("/", (req, res) => handleBrowse(req, res, "latest_update"));
router.get("/best_match", (req, res) => handleBrowse(req, res, "best_match"));
router.get("/recently_added", (req, res) =>
  handleBrowse(req, res, "recently_added"),
);
router.get("/title_asc", (req, res) => handleBrowse(req, res, "title_asc"));
router.get("/title_desc", (req, res) => handleBrowse(req, res, "title_desc"));
router.get("/year_newest", (req, res) => handleBrowse(req, res, "year_newest"));
router.get("/year_oldest", (req, res) => handleBrowse(req, res, "year_oldest"));
router.get("/highest_rated", (req, res) =>
  handleBrowse(req, res, "highest_rated"),
);
router.get("/trending", (req, res) => handleBrowse(req, res, "trending"));
router.get("/most_viewed_7d", (req, res) =>
  handleBrowse(req, res, "most_viewed_7d"),
);
router.get("/most_viewed_30d", (req, res) =>
  handleBrowse(req, res, "most_viewed_30d"),
);
router.get("/most_viewed_all", (req, res) =>
  handleBrowse(req, res, "most_viewed_all"),
);
router.get("/most_followed", (req, res) =>
  handleBrowse(req, res, "most_followed"),
);

module.exports = router;
