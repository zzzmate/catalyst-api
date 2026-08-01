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
    console.log("[AniDB Hero] Launching browser for:", BASE_URL + "/home");

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

    $(".hero-swiper .swiper-slide").each((i, el) => {
      const $el = $(el);

      const $posterLink = $el.find('a[href*="/anime/"]').first();
      const animeUrl = $posterLink.attr("href") || "";
      const urlMatch = animeUrl.match(/\/anime\/([^#?]+)/);
      if (!urlMatch) return;

      const fullSlug = urlMatch[1];
      if (seenIds.has(fullSlug)) return;
      seenIds.add(fullSlug);

      const slugMatch = fullSlug.match(/^(.+)-(\d+)$/);
      const slug = slugMatch ? slugMatch[1] : fullSlug;
      const id = slugMatch ? slugMatch[2] : null;

      const $title = $el.find("h2").first();
      const title = $title.text().trim() || null;

      const $poster = $el.find('img[style*="aspect-ratio"]').first();
      const poster = $poster.attr("src") || null;

      const $desc = $el.find("p.text-faint").first();
      const description = $desc.text().trim() || null;

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
        const ratingText = $ratingBadge.text().trim();
        const parsed = parseFloat(ratingText);
        if (!isNaN(parsed)) rating = parsed;
      }

      let status = null;
      const $statusBadge = $el
        .find(".badge-gray, .badge-green")
        .filter((j, badge) => {
          const text = $(badge).text().trim().toLowerCase();
          return (
            text.includes("airing") ||
            text.includes("finished") ||
            text.includes("upcoming")
          );
        })
        .first();
      if ($statusBadge.length) status = $statusBadge.text().trim();

      const $watchBtn = $el.find('a[href*="#player"]').first();
      let watchUrl = null;
      if ($watchBtn.length) {
        const href = $watchBtn.attr("href") || "";
        watchUrl = href.startsWith("http") ? href : BASE_URL + href;
      }

      items.push({
        id,
        slug,
        fullSlug,
        title,
        url: animeUrl.startsWith("http") ? animeUrl : BASE_URL + animeUrl,
        poster,
        description,
        type,
        rating,
        status,
        watchUrl,
      });
    });

    res.json({
      items,
      total: items.length,
    });
  } catch (error) {
    if (browser) await browser.close();
    console.error("[AniDB Hero] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch hero animes",
      message: error.message,
    });
  }
});

module.exports = router;
