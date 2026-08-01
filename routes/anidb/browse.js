const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const router = express.Router();

puppeteer.use(StealthPlugin());

const BASE_URL = "https://anidb.app";

const GENRE_MAP = {
  1: "Action",
  3: "Adventure",
  19: "Avant Garde",
  12: "Award Winning",
  16: "Boys Love",
  5: "Comedy",
  2: "Drama",
  13: "Ecchi",
  17: "Erotica",
  4: "Fantasy",
  20: "Girls Love",
  8: "Gourmet",
  15: "Hentai",
  21: "Horror",
  7: "Mystery",
  14: "Romance",
  6: "Sci-Fi",
  9: "Slice of Life",
  11: "Sports",
  10: "Supernatural",
  18: "Suspense",
};

const VALID_TYPES = ["Movie", "Music", "ONA", "OVA", "Special", "TV"];
const VALID_STATUSES = ["Currently Airing", "Finished Airing"];
const VALID_SEASONS = ["fall", "spring", "summer", "winter"];
const VALID_SORTS = [
  "order_trending",
  "order_top",
  "order_updated",
  "order_popular",
  "order_favorite",
  "order_top_airing",
  "title",
  "aired_start",
];

router.get("/", async (req, res) => {
  let browser;

  try {
    const {
      q = "",
      type = "",
      status = "",
      season = "",
      year = "",
      genres = "",
      sort = "order_top",
      page = "1",
    } = req.query;

    const params = new URLSearchParams();

    if (q && q.trim()) params.set("q", q.trim());
    if (type && VALID_TYPES.includes(type)) params.set("type", type);
    if (status && VALID_STATUSES.includes(status)) params.set("status", status);
    if (season && VALID_SEASONS.includes(season)) params.set("season", season);
    if (year && /^\d{4}$/.test(year)) params.set("year", year);
    if (genres && GENRE_MAP[genres]) params.set("genres", genres);
    if (sort && VALID_SORTS.includes(sort)) params.set("sort", sort);
    if (page && parseInt(page) > 1) params.set("page", page);

    const browseUrl = `${BASE_URL}/browse?${params.toString()}`;

    console.log("[AniDB Browse] Launching browser for:", browseUrl);

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const browserPage = await browser.newPage();
    await browserPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    await browserPage.goto(browseUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await new Promise((r) => setTimeout(r, 3000));

    const html = await browserPage.content();
    await browser.close();

    const $ = cheerio.load(html);
    const items = [];
    const seenIds = new Set();

    let totalResults = null;
    $("p.text-muted, p.text-sm").each((i, el) => {
      const text = $(el).text().trim();
      const match = text.match(/^(\d[\d,]*)\s*results?$/i);
      if (match) {
        totalResults = parseInt(match[1].replace(/,/g, ""));
        return false;
      }
    });

    const activeFilters = {};
    if (q && q.trim()) activeFilters.query = q.trim();
    if (type) activeFilters.type = type;
    if (status) activeFilters.status = status;
    if (season) activeFilters.season = season;
    if (year) activeFilters.year = year;
    if (genres && GENRE_MAP[genres]) {
      activeFilters.genre = { id: genres, name: GENRE_MAP[genres] };
    }
    activeFilters.sort = sort;
    activeFilters.page = parseInt(page) || 1;

    const availableFilters = {
      types: [],
      statuses: [],
      seasons: [],
      years: [],
      genres: [],
      sorts: [],
    };

    $('select[name="type"] option').each((i, el) => {
      const val = $(el).attr("value");
      if (val) availableFilters.types.push(val);
    });

    $('select[name="status"] option').each((i, el) => {
      const val = $(el).attr("value");
      if (val) availableFilters.statuses.push(val);
    });

    $('select[name="season"] option').each((i, el) => {
      const val = $(el).attr("value");
      if (val) availableFilters.seasons.push(val);
    });

    $('select[name="year"] option').each((i, el) => {
      const val = $(el).attr("value");
      if (val) availableFilters.years.push(val);
    });

    $('select[name="genres"] option').each((i, el) => {
      const val = $(el).attr("value");
      const text = $(el).text().trim();
      if (val) availableFilters.genres.push({ id: val, name: text });
    });

    $('select[name="sort"] option').each((i, el) => {
      const val = $(el).attr("value");
      const text = $(el).text().trim();
      if (val) availableFilters.sorts.push({ value: val, label: text });
    });

    let hasNextPage = false;
    let hasPrevPage = parseInt(page) > 1;
    let currentPage = parseInt(page) || 1;

    $('a[href*="page="]').each((i, el) => {
      const href = $(el).attr("href") || "";
      const pageMatch = href.match(/page=(\d+)/);
      if (pageMatch) {
        const linkedPage = parseInt(pageMatch[1]);
        if (linkedPage > currentPage) {
          hasNextPage = true;
          return false;
        }
      }
    });

    $(".anime-grid a.anime-card").each((i, el) => {
      const $card = $(el);

      const href = $card.attr("href") || "";
      const urlMatch = href.match(/\/anime\/([^#?]+)/);
      if (!urlMatch) return;

      const fullSlug = urlMatch[1];
      if (seenIds.has(fullSlug)) return;
      seenIds.add(fullSlug);

      const slugMatch = fullSlug.match(/^(.+)-(\d+)$/);
      const slug = slugMatch ? slugMatch[1] : fullSlug;
      const id = slugMatch ? slugMatch[2] : null;

      const title = $card.attr("title")?.trim() || null;

      const poster = $card.find("img").first().attr("src") || null;

      let animeType = null;
      const $typeBadge = $card.find(".badge-orange").first();
      if ($typeBadge.length) animeType = $typeBadge.text().trim();

      let rating = null;
      const $ratingBadge = $card
        .find(".badge-gray")
        .filter((j, badge) => {
          return $(badge).find(".text-yellow-400").length > 0;
        })
        .first();

      if ($ratingBadge.length) {
        const ratingText = $ratingBadge
          .clone()
          .find("svg")
          .remove()
          .end()
          .text()
          .trim();
        const parsed = parseFloat(ratingText);
        if (!isNaN(parsed)) rating = parsed;
      }

      items.push({
        id,
        slug,
        fullSlug,
        title,
        url: href.startsWith("http") ? href : BASE_URL + href,
        poster,
        type: animeType,
        rating,
      });
    });

    res.json({
      results: items,
      total: totalResults,
      count: items.length,
      filters: activeFilters,
      availableFilters,
      pagination: {
        currentPage,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? currentPage + 1 : null,
        prevPage: hasPrevPage ? currentPage - 1 : null,
      },
    });
  } catch (error) {
    if (browser) await browser.close();
    console.error("[AniDB Browse] Error:", error.message);
    res.status(500).json({
      error: "Failed to browse anime",
      message: error.message,
    });
  }
});

module.exports = router;
