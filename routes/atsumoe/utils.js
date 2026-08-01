const fs = require("fs");
const path = require("path");

const BASE_URL = "https://atsu.moe";
const API_BASE = "https://atsu.moe/api/home2";
const CDN_URL = "https://cdn.atsu.moe/static";
const CDN_ROOT = "https://cdn.atsu.moe";

const TIMEFRAME_MAP = {
  day: "daily",
  daily: "daily",
  week: "weekly",
  weekly: "weekly",
  month: "monthly",
  monthly: "monthly",
  all: "all",
  all_time: "all",
};

const configPath = path.join(__dirname, "..", "..", "config.json");

function getConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function splitValues(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap((v) => splitValues(v));
  return String(input)
    .split(/[,.]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeTypes(input, defaults) {
  const config = getConfig();
  const map = config.atsumoe.types || {};
  const validValues = [...new Set(Object.values(map))];
  const fallback = defaults || validValues;

  const arr = splitValues(input);
  if (arr.length === 0) return fallback.join(",");

  const result = [];
  arr.forEach((t) => {
    const key = Object.keys(map).find(
      (k) => k.toLowerCase() === t.toLowerCase(),
    );
    if (key) result.push(map[key]);
    else if (validValues.includes(t)) result.push(t);
  });

  const unique = [...new Set(result)];
  return unique.length > 0 ? unique.join(",") : fallback.join(",");
}

function normalizeStatuses(input) {
  const config = getConfig();
  const map = config.atsumoe.statuses || {};
  const validValues = [...new Set(Object.values(map))];

  const arr = splitValues(input);
  if (arr.length === 0) return null;

  const result = [];
  arr.forEach((s) => {
    const key = Object.keys(map).find(
      (k) => k.toLowerCase() === s.toLowerCase(),
    );
    if (key) result.push(map[key]);
    else if (validValues.includes(s)) result.push(s);
  });

  const unique = [...new Set(result)];
  return unique.length > 0 ? unique.join(",") : null;
}

function normalizeGenres(input) {
  const config = getConfig();
  const map = config.atsumoe.genres || {};

  const arr = splitValues(input);
  if (arr.length === 0) return null;

  const result = [];
  arr.forEach((g) => {
    if (/^\d+$/.test(g)) {
      result.push(parseInt(g));
      return;
    }
    const key = Object.keys(map).find(
      (k) => k.toLowerCase() === g.toLowerCase(),
    );
    if (key) result.push(map[key]);
  });

  const unique = [...new Set(result)];
  return unique.length > 0 ? unique.join(",") : null;
}

function getTimeframe(tf) {
  if (!tf) return "daily";
  return TIMEFRAME_MAP[tf.toLowerCase()] || "daily";
}

function prefixImageUrls(data) {
  if (!data) return data;

  const stringified = JSON.stringify(data);
  const fixed = stringified.replace(
    /"([^"]*\.(?:webp|png|jpg|jpeg|gif|avif))"/gi,
    (match, url) => {
      if (url.startsWith("http://") || url.startsWith("https://")) return match;
      if (url.startsWith("/static/")) {
        return `"${CDN_ROOT}${url}"`;
      }
      const prefixed = url.startsWith("/")
        ? `${CDN_URL}${url}`
        : `${CDN_URL}/${url}`;
      return `"${prefixed}"`;
    },
  );

  return JSON.parse(fixed);
}

module.exports = {
  BASE_URL,
  API_BASE,
  CDN_URL,
  CDN_ROOT,
  normalizeTypes,
  normalizeStatuses,
  normalizeGenres,
  getTimeframe,
  prefixImageUrls,
};
