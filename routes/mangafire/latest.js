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
  "latest_uploads",
);

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getCacheKey(page, limit) {
  return `p${page}_l${limit}`;
}

function getCachePath(page, limit) {
  return path.join(cacheDir, `${getCacheKey(page, limit)}.json`);
}

function getCachedData(page, limit) {
  const filePath = getCachePath(page, limit);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveCachedData(page, limit, data) {
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(getCachePath(page, limit), JSON.stringify(data, null, 2));
}

function isCacheValid(page, limit) {
  const config = getConfig();
  const { cacheMinutes, cached } = config.mangafire.caching.latest_uploads;
  const key = getCacheKey(page, limit);
  if (!cached[key] || !fs.existsSync(getCachePath(page, limit))) return false;
  const diff = (Date.now() - new Date(cached[key]).getTime()) / 1000 / 60;
  return diff < cacheMinutes;
}

function updateLastCached(page, limit) {
  const config = getConfig();
  const key = getCacheKey(page, limit);
  config.mangafire.caching.latest_uploads.cached[key] =
    new Date().toISOString();
  saveConfig(config);
}

router.get("/", async (req, res) => {
  const { limit = 30, page = 1 } = req.query;

  if (isCacheValid(page, limit)) {
    const cached = getCachedData(page, limit);
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
      if (url.includes("/api/titles") && url.includes("chapter_updated_at")) {
        try {
          apiData = await response.json();
        } catch (e) {}
      }
    });

    await browserPage.goto("https://mangafire.to/", {
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

    if (!apiData) {
      await browserPage.goto(
        "https://mangafire.to/filter?keyword=&order=recently_updated",
        {
          waitUntil: "networkidle2",
          timeout: 30000,
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    if (!apiData) {
      const capturedUrl = await browserPage.evaluate(() => {
        return new Promise((resolve) => {
          const origOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function (method, url) {
            if (
              url.includes("/api/titles") &&
              url.includes("chapter_updated_at")
            ) {
              resolve(url);
            }
            origOpen.apply(this, arguments);
          };
          window.scrollTo(0, 0);
          setTimeout(() => resolve(null), 10000);
        });
      });

      if (capturedUrl) {
        const modifiedUrl = capturedUrl
          .replace(/page=\d+/, `page=${page}`)
          .replace(/limit=\d+/, `limit=${limit}`);

        await browserPage.goto(modifiedUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        const content = await browserPage.evaluate(
          () => document.body.innerText,
        );
        try {
          apiData = JSON.parse(content);
        } catch (e) {}
      }
    }

    await browser.close();

    if (apiData) {
      saveCachedData(page, limit, apiData);
      updateLastCached(page, limit);
      res.json({ cached: false, ...apiData });
    } else {
      res.status(500).json({ error: "Could not capture latest uploads data" });
    }
  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({
      error: "Failed to fetch latest uploads",
      message: error.message,
    });
  }
});

module.exports = router;
