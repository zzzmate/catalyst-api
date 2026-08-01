const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const router = express.Router();

puppeteer.use(StealthPlugin());

const BASE_URL = "https://anidb.app";

function parseEntry($, el, rank) {
  const $el = $(el);

  const href = $el.attr("href") || "";
  const urlMatch = href.match(/\/anime\/([^#?]+)/);
  if (!urlMatch) return null;

  const fullSlug = urlMatch[1];
  const slugMatch = fullSlug.match(/^(.+)-(\d+)$/);
  const slug = slugMatch ? slugMatch[1] : fullSlug;
  const id = slugMatch ? slugMatch[2] : null;

  const title = $el.attr("title")?.trim() || null;

  const poster = $el.find("img").first().attr("src") || null;

  let rating = null;
  const $ratingSpan = $el.find("span.text-yellow-400").first();
  if ($ratingSpan.length) {
    const ratingText = $ratingSpan
      .clone()
      .find("svg")
      .remove()
      .end()
      .text()
      .trim();
    const parsed = parseFloat(ratingText);
    if (!isNaN(parsed)) rating = parsed;
  }

  let type = null;
  let season = null;

  const $metaWrap = $el.find("span.text-muted").first();
  if ($metaWrap.length) {
    const metaTexts = [];
    $metaWrap.children("span").each((i, span) => {
      const $span = $(span);
      if ($span.hasClass("text-yellow-400")) return;
      if ($span.hasClass("text-bd")) return;
      const text = $span.text().trim();
      if (text) metaTexts.push(text);
    });

    const typeValues = ["TV", "ONA", "OVA", "Movie", "Special", "Music"];
    for (const t of metaTexts) {
      if (typeValues.includes(t)) {
        type = t;
      } else if (/^(Winter|Spring|Summer|Fall|Autumn)\s+\d{4}$/i.test(t)) {
        season = t;
      }
    }
  }

  let status = null;
  const $statusSpan = $el.find("span.text-green-400, span.text-faint").last();
  if ($statusSpan.length) {
    const statusText = $statusSpan.text().trim();
    if (
      statusText.toLowerCase().includes("airing") ||
      statusText.toLowerCase().includes("finished") ||
      statusText.toLowerCase().includes("upcoming")
    ) {
      status = statusText;
    }
  }

  return {
    rank,
    id,
    slug,
    fullSlug,
    title,
    url: href.startsWith("http") ? href : BASE_URL + href,
    poster,
    type,
    rating,
    season,
    status,
  };
}

router.get("/", async (req, res) => {
  let browser;

  try {
    console.log("[AniDB Charts] Launching browser for:", BASE_URL + "/home");

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    await page.goto(BASE_URL + "/home", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await new Promise((r) => setTimeout(r, 3000));

    const html = await page.content();
    await browser.close();

    const $ = cheerio.load(html);

    const periodMap = {
      "24H": "today",
      "7D": "week",
      "30D": "month",
    };

    const charts = {};

    let $chartsSection = null;

    $("section").each((i, section) => {
      if ($(section).text().includes("Top 10 Anime Charts")) {
        $chartsSection = $(section);
        return false;
      }
    });

    if (!$chartsSection || !$chartsSection.length) {
      $("div").each((i, div) => {
        if (
          $(div).text().includes("Top 10 Anime Charts") &&
          $(div).find("article").length === 3
        ) {
          $chartsSection = $(div);
          return false;
        }
      });
    }

    if ($chartsSection && $chartsSection.length) {
      $chartsSection.find("article").each((i, article) => {
        const $article = $(article);

        const $badge = $article
          .find("header span")
          .filter((j, sp) => {
            const t = $(sp).text().trim();
            return ["24H", "7D", "30D"].includes(t);
          })
          .first();

        const badgeText = $badge.length ? $badge.text().trim() : null;
        const periodKey =
          badgeText && periodMap[badgeText] ? periodMap[badgeText] : null;

        if (!periodKey) return;

        const chartTitle =
          $article.find("header h3").first().text().trim() || null;
        const chartSubtitle =
          $article.find("header p").first().text().trim() || null;

        const items = [];
        $article.find("div.space-y-2 > a").each((j, entry) => {
          const rank = j + 1;
          const parsed = parseEntry($, entry, rank);
          if (parsed) items.push(parsed);
        });

        charts[periodKey] = {
          label: chartTitle,
          subtitle: chartSubtitle,
          period: badgeText,
          items,
          total: items.length,
        };
      });
    }

    res.json({
      charts,
      periods: Object.keys(charts),
    });
  } catch (error) {
    if (browser) await browser.close();
    console.error("[AniDB Charts] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch top 10 charts",
      message: error.message,
    });
  }
});

module.exports = router;
