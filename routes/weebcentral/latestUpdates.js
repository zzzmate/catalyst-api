const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

const BASE_URL = "https://weebcentral.com";

function parseArticles($, $container) {
  const items = [];
  const seenChapters = new Set();

  $container.find("article").each((i, el) => {
    const $el = $(el);
    const title = $el.attr("data-tip") || null;

    const anchors = $el.find("a");
    let seriesUrl = "";
    let chapterUrl = "";

    anchors.each((j, a) => {
      const href = $(a).attr("href") || "";
      if (href.includes("/series/") && !seriesUrl) seriesUrl = href;
      if (href.includes("/chapters/") && !chapterUrl) chapterUrl = href;
    });

    const seriesMatch = seriesUrl.match(/\/series\/([^/]+)\/([^/?#]+)/);
    const seriesId = seriesMatch ? seriesMatch[1] : null;
    const seriesSlug = seriesMatch ? seriesMatch[2] : null;

    const chapterMatch = chapterUrl.match(/\/chapters\/([^/?#]+)/);
    const chapterId = chapterMatch ? chapterMatch[1] : null;

    if (!chapterId || seenChapters.has(chapterId)) return;
    seenChapters.add(chapterId);

    const chapterLabel =
      $el
        .find("span")
        .filter((k, s) => {
          const t = $(s).text().trim();
          return t && !t.includes("cover");
        })
        .first()
        .text()
        .trim() || null;

    const dateTime = $el.find("time").attr("datetime") || null;
    const dateDisplay = $el.find("time").text().trim() || null;

    const $img = $el.find("img").first();
    const image = $img.attr("src") || null;

    let webpImage = null;
    $el.find("source").each((j, s) => {
      const srcset = $(s).attr("srcset");
      if (srcset && !webpImage) webpImage = srcset.split(" ")[0];
    });

    items.push({
      title,
      series: {
        id: seriesId,
        slug: seriesSlug,
        url: seriesUrl || null,
      },
      chapter: {
        id: chapterId,
        label: chapterLabel,
        url: chapterUrl || null,
        uploadedAt: dateTime,
        uploadedAtDisplay: dateDisplay,
      },
      cover: {
        small: image,
        webp: webpImage,
      },
    });
  });

  return items;
}

router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || null;

  try {
    let items = [];
    let hasMore = true;
    let currentPage = 1;
    let lastUrl = BASE_URL;

    while (currentPage <= page && hasMore) {
      const url =
        currentPage === 1
          ? BASE_URL
          : `${BASE_URL}/latest-updates/${currentPage}`;

      console.log("[WeebCentral Latest Updates] Fetching:", url);

      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
          Referer: BASE_URL,
        },
      });

      const $ = cheerio.load(response.data);

      let $container = $("h2")
        .filter((i, el) => {
          return $(el).text().trim().includes("Latest Updates");
        })
        .parent()
        .find("section")
        .first();

      if (!$container.length) {
        $container = $("section")
          .filter((i, el) => {
            return $(el).find("article[data-tip]").length > 5;
          })
          .first();
      }

      if (!$container.length) {
        $container = $("body");
      }

      const pageItems = parseArticles($, $container);

      if (pageItems.length === 0) {
        hasMore = false;
      } else {
        if (currentPage === page) {
          items = pageItems;
        }

        const $viewMore = $container
          .find('button[hx-get*="/latest-updates/"]')
          .first();
        hasMore = $viewMore.length > 0;
        if (hasMore) {
          lastUrl = $viewMore.attr("hx-get") || null;
        }
      }

      currentPage++;
    }

    if (limit && items.length > limit) {
      items = items.slice(0, limit);
    }

    res.json({
      page,
      limit,
      items,
      total: items.length,
      hasMore,
    });
  } catch (error) {
    console.error("[WeebCentral Latest Updates] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch latest updates",
      message: error.message,
    });
  }
});

module.exports = router;
