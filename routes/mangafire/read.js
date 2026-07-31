const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const router = express.Router();

puppeteer.use(StealthPlugin());

const configPath = path.join(__dirname, "..", "..", "config.json");
const cacheDir = path.join(__dirname, "..", "..", "cache", "mangafire", "read");

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getCachePath(chapterId) {
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, `${chapterId}.json`);
}

function isCacheValid(chapterId) {
  const config = getConfig();
  const { cacheMinutes, cached } = config.mangafire.caching.read;
  const key = `ch_${chapterId}`;
  if (!cached[key] || !fs.existsSync(getCachePath(chapterId))) return false;
  const diff = (Date.now() - new Date(cached[key]).getTime()) / 1000 / 60;
  return diff < cacheMinutes;
}

function getCachedData(chapterId) {
  const filePath = getCachePath(chapterId);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveCachedData(chapterId, data) {
  fs.writeFileSync(getCachePath(chapterId), JSON.stringify(data, null, 2));
}

function updateLastCached(chapterId) {
  const config = getConfig();
  const key = `ch_${chapterId}`;
  config.mangafire.caching.read.cached[key] = new Date().toISOString();
  saveConfig(config);
}

function rewriteImageUrls(data, proxyBase) {
  if (!data || !data.data || !data.data.pages) return data;
  const rewritten = JSON.parse(JSON.stringify(data));
  rewritten.data.pages = rewritten.data.pages.map((page) => {
    return {
      ...page,
      original_url: page.url,
      url: `${proxyBase}?url=${encodeURIComponent(page.url)}`,
    };
  });
  return rewritten;
}

router.get("/:slug/:chapterId", async (req, res) => {
  const { slug, chapterId } = req.params;
  const proxyBase = `${req.protocol}://${req.get("host")}/mangafire/proxy`;

  if (isCacheValid(chapterId)) {
    const cached = getCachedData(chapterId);
    if (cached) {
      const rewritten = rewriteImageUrls(cached, proxyBase);
      return res.json({ cached: true, ...rewritten });
    }
  }

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
      if (url.includes(`/api/chapters/${chapterId}`) && url.includes("vrf=")) {
        try {
          apiData = await response.json();
          resolveData(apiData);
        } catch (e) {}
      }
    });

    const chapterUrl = `https://mangafire.to/title/${slug}/chapter/${chapterId}`;
    console.log("[Read] Navigating to:", chapterUrl);

    await page.goto(chapterUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await Promise.race([
      dataPromise,
      new Promise((resolve) => setTimeout(resolve, 10000)),
    ]);

    if (!apiData) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    await browser.close();

    if (apiData) {
      saveCachedData(chapterId, apiData);
      updateLastCached(chapterId);
      const rewritten = rewriteImageUrls(apiData, proxyBase);
      res.json({ cached: false, ...rewritten });
    } else {
      res
        .status(500)
        .json({ error: "Could not capture chapter data for " + chapterId });
    }
  } catch (error) {
    if (browser) await browser.close();
    console.error("[Read] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch chapter",
      message: error.message,
    });
  }
});

module.exports = router;
