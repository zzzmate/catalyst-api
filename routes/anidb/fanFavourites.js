const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const router = express.Router();

puppeteer.use(StealthPlugin());

const BASE_URL = "https://anidb.app";

router.get("/", async (req, res) => {
  let browser;

  try {
    console.log("[AniDB Trending] Launching browser for:", BASE_URL + "/home");

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
    const items = [];
    const seenIds = new Set();

    $(".awaited-swiper .swiper-slide").each((i, el) => {
      const $el = $(el);

      const $cardLink = $el.find("a.awaited-card").first();
      const animeUrl = $cardLink.attr("href") || "";
      const urlMatch = animeUrl.match(/\/anime\/([^#?]+)/);
      if (!urlMatch) return;

      const fullSlug = urlMatch[1];
      if (seenIds.has(fullSlug)) return;
      seenIds.add(fullSlug);

      const slugMatch = fullSlug.match(/^(.+)-(\d+)$/);
      const slug = slugMatch ? slugMatch[1] : fullSlug;
      const id = slugMatch ? slugMatch[2] : null;

      const title =
        $cardLink.attr("title")?.trim() ||
        $el.find("p.text-white").first().text().trim() ||
        null;

      const poster = $el.find("img").first().attr("src") || null;

      let rating = null;
      const $ratingBadge = $el
        .find("div")
        .filter((j, badge) => {
          return (
            $(badge).find("svg").length > 0 &&
            $(badge).hasClass("text-yellow-400")
          );
        })
        .first();

      const $yellowBadge = $el.find(".text-yellow-400").closest("div").first();

      if ($yellowBadge.length) {
        const rawText = $yellowBadge
          .clone()
          .find("svg")
          .remove()
          .end()
          .text()
          .trim();
        const parsed = parseFloat(rawText);
        if (!isNaN(parsed)) rating = parsed;
      }

      let type = null;
      $el.find("span").each((j, span) => {
        const text = $(span).text().trim();
        if (["TV", "Movie", "OVA", "ONA", "Special"].includes(text)) {
          type = text;
          return false;
        }
      });

      let season = null;
      const seasonRegex = /^(Winter|Spring|Summer|Fall|Autumn)\s+\d{4}$/i;
      $el.find("span").each((j, span) => {
        const text = $(span).text().trim();
        if (seasonRegex.test(text)) {
          season = text;
          return false;
        }
      });

      const hasNewEpisode =
        $el.find("div").filter((j, badge) => {
          return $(badge).text().includes("NEW EP");
        }).length > 0;

      items.push({
        id,
        slug,
        fullSlug,
        title,
        url: animeUrl.startsWith("http") ? animeUrl : BASE_URL + animeUrl,
        poster,
        type,
        rating,
        season,
        hasNewEpisode,
      });
    });

    res.json({
      items,
      total: items.length,
    });
  } catch (error) {
    if (browser) await browser.close();
    console.error("[AniDB Trending] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch trending animes",
      message: error.message,
    });
  }
});

module.exports = router;
