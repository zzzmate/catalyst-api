const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const router = express.Router();

puppeteer.use(StealthPlugin());

const configPath = path.join(__dirname, "..", "..", "config.json");
const cacheDir = path.join(__dirname, "..", "..", "cache", "mangafire", "info");

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getCachePath(slug, type, extra) {
  const dir = path.join(cacheDir, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${type}_${extra}.json`);
}

function isCacheValid(slug, type, extra) {
  const config = getConfig();
  const { cacheMinutes, cached } = config.mangafire.caching.info;
  const key = `${slug}_${type}_${extra}`;
  if (!cached[key] || !fs.existsSync(getCachePath(slug, type, extra)))
    return false;
  const diff = (Date.now() - new Date(cached[key]).getTime()) / 1000 / 60;
  return diff < cacheMinutes;
}

function getCachedData(slug, type, extra) {
  const filePath = getCachePath(slug, type, extra);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveCachedData(slug, type, extra, data) {
  fs.writeFileSync(
    getCachePath(slug, type, extra),
    JSON.stringify(data, null, 2),
  );
}

function updateLastCached(slug, type, extra) {
  const config = getConfig();
  const key = `${slug}_${type}_${extra}`;
  config.mangafire.caching.info.cached[key] = new Date().toISOString();
  saveConfig(config);
}

async function fetchWithPuppeteer(targetUrl, interceptMatch) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    let apiData = null;
    let resolveData;
    const dataPromise = new Promise((resolve) => {
      resolveData = resolve;
    });

    await page.setRequestInterception(true);

    page.on("request", (request) => {
      request.continue();
    });

    page.on("response", async (response) => {
      const url = response.url();
      if (interceptMatch(url)) {
        try {
          apiData = await response.json();
          resolveData(apiData);
        } catch (e) {}
      }
    });

    await page.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await Promise.race([
      dataPromise,
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);

    if (!apiData) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    await browser.close();
    return apiData;
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const cacheExtra = "details";

  if (isCacheValid(slug, "details", cacheExtra)) {
    const cached = getCachedData(slug, "details", cacheExtra);
    if (cached) {
      return res.json({ cached: true, ...cached });
    }
  }

  try {
    const pageUrl = `https://mangafire.to/title/${slug}`;
    console.log("[Info] Fetching details for:", slug);

    const apiData = await fetchWithPuppeteer(pageUrl, (url) => {
      return (
        url.includes(`/api/titles/${slug}`) &&
        !url.includes("/chapters") &&
        url.includes("vrf=")
      );
    });

    if (apiData) {
      saveCachedData(slug, "details", cacheExtra, apiData);
      updateLastCached(slug, "details", cacheExtra);
      res.json({ cached: false, ...apiData });
    } else {
      res
        .status(500)
        .json({ error: "Could not capture info data for " + slug });
    }
  } catch (error) {
    console.error("[Info] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch info",
      message: error.message,
    });
  }
});

router.get("/:slug/chapters", async (req, res) => {
  const { slug } = req.params;
  const {
    language = "en",
    sort = "number",
    order = "asc",
    page = 1,
    limit = 20,
  } = req.query;
  const cacheExtra = `${language}_${sort}_${order}_p${page}_l${limit}`;

  if (isCacheValid(slug, "chapters", cacheExtra)) {
    const cached = getCachedData(slug, "chapters", cacheExtra);
    if (cached) {
      return res.json({ cached: true, ...cached });
    }
  }

  try {
    const params = new URLSearchParams({
      language,
      sort,
      order,
      page,
      limit,
    });
    const pageUrl = `https://mangafire.to/title/${slug}?${params.toString()}`;
    console.log(
      "[Info] Fetching chapters for:",
      slug,
      `(${language}, ${sort}, ${order}, p${page}, l${limit})`,
    );

    const apiData = await fetchWithPuppeteer(pageUrl, (url) => {
      return (
        url.includes(`/api/titles/${slug}/chapters`) && url.includes("vrf=")
      );
    });

    if (apiData) {
      saveCachedData(slug, "chapters", cacheExtra, apiData);
      updateLastCached(slug, "chapters", cacheExtra);
      res.json({ cached: false, ...apiData });
    } else {
      res
        .status(500)
        .json({ error: "Could not capture chapters data for " + slug });
    }
  } catch (error) {
    console.error("[Info] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch chapters",
      message: error.message,
    });
  }
});

module.exports = router;
