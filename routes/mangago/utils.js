const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const BASE_URL = "https://www.mangago.me";
const configPath = path.join(__dirname, "..", "..", "config.json");

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function extractSlug(url) {
  if (!url) return null;
  const match = url.match(/\/read-manga\/([^/]+)/);
  return match ? match[1] : null;
}

function extractChapterId(url) {
  if (!url) return null;
  const match = url.match(
    /br_chapter-(\d+)|nml_chapter-(\d+)|iur_chapter-([^/]+)/,
  );
  return match ? match[1] || match[2] || match[3] : null;
}

function absoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return BASE_URL + url;
  return BASE_URL + "/" + url;
}

async function fetchPage(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));
    const html = await page.content();
    await browser.close();
    return html;
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

function getCacheDir(endpoint) {
  const dir = path.join(__dirname, "..", "..", "cache", "mangago", endpoint);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isCacheValid(endpoint, key) {
  const config = getConfig();
  const cache = config.mangago?.caching?.[endpoint];
  if (!cache) return false;
  const cached = cache.cached?.[key || "default"];
  if (!cached) return false;
  const diff = (Date.now() - new Date(cached).getTime()) / 1000 / 60;
  return diff < (cache.cacheMinutes || 15);
}

function getCachedData(endpoint, key) {
  const filePath = path.join(getCacheDir(endpoint), `${key || "default"}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveCachedData(endpoint, key, data) {
  const filePath = path.join(getCacheDir(endpoint), `${key || "default"}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  const config = getConfig();
  if (!config.mangago) config.mangago = {};
  if (!config.mangago.caching) config.mangago.caching = {};
  if (!config.mangago.caching[endpoint])
    config.mangago.caching[endpoint] = { cacheMinutes: 15, cached: {} };
  if (!config.mangago.caching[endpoint].cached)
    config.mangago.caching[endpoint].cached = {};
  config.mangago.caching[endpoint].cached[key || "default"] =
    new Date().toISOString();
  saveConfig(config);
}

module.exports = {
  BASE_URL,
  extractSlug,
  extractChapterId,
  absoluteUrl,
  fetchPage,
  isCacheValid,
  getCachedData,
  saveCachedData,
};
