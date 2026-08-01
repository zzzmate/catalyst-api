const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const router = express.Router();

puppeteer.use(StealthPlugin());

const BASE_URL = "https://anidb.app";
const SECTION_TITLE = "Top Movie";

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

    let targetSection = null;

    $("section").each((i, section) => {
      const heading = $(section).find("h2").first().text().trim();
      if (heading.includes(SECTION_TITLE)) {
        targetSection = $(section);
        return false;
      }
    });

    if (!targetSection) {
      return res.json({ items: [], total: 0 });
    }

    targetSection.find(".swiper-slide").each((i, el) => {
      const $el = $(el);

      const $card = $el.find("a.anime-card").first();
      if (!$card.length) return;

      const href = $card.attr("href") || "";
      const urlMatch = href.match(/\/anime\/([^#?]+)/);
      if (!urlMatch) return;

      const fullSlug = urlMatch[1];
      if (seenIds.has(fullSlug)) return;
      seenIds.add(fullSlug);

      const slugMatch = fullSlug.match(/^(.+)-(\d+)$/);
      const slug = slugMatch ? slugMatch[1] : fullSlug;
      const id = slugMatch ? slugMatch[2] : null;

      const title =
        $card.attr("title")?.trim() ||
        $card.find("p").first().text().trim() ||
        null;

      const poster = $card.find("img").attr("src") || null;

      let type = null;
      const $typeBadge = $el.find(".badge-orange").first();
      if ($typeBadge.length) type = $typeBadge.text().trim();

      let rating = null;
      const $ratingBadge = $el
        .find(".badge-gray")
        .filter((j, badge) => {
          return $(badge).find(".text-yellow-400").length > 0;
        })
        .first();

      if ($ratingBadge.length) {
        const text = $ratingBadge
          .clone()
          .find("svg")
          .remove()
          .end()
          .text()
          .trim();
        const parsed = parseFloat(text);
        if (!isNaN(parsed)) rating = parsed;
      }

      items.push({
        id,
        slug,
        fullSlug,
        title,
        url: href.startsWith("http") ? href : BASE_URL + href,
        poster,
        type,
        rating,
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
