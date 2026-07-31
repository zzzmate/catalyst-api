const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

const BASE_URL = "https://mangadot.net";

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const url = `${BASE_URL}/manga/${id}`;
    console.log("[MangaDotNet Info] Fetching:", url);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
    });

    const $ = cheerio.load(response.data);

    const title = $("h1").first().text().trim() || null;
    const description =
      $(".text-white\\/60.leading-\\[1\\.7\\] > div").first().text().trim() ||
      null;

    let cover = null;
    const $coverImg = $("img")
      .filter((i, el) => {
        const alt = $(el).attr("alt");
        const src = $(el).attr("src") || "";
        return alt === title && src.includes("/uploads/");
      })
      .first();
    if ($coverImg.length) {
      const src = $coverImg.attr("src");
      cover = src.startsWith("http") ? src : BASE_URL + src;
    }

    let status = null;
    const $statusBadge = $("span")
      .filter((i, el) => {
        const cls = $(el).attr("class") || "";
        return (
          cls.includes("rounded-full") &&
          cls.includes("border") &&
          (cls.includes("green-500") ||
            cls.includes("red-500") ||
            cls.includes("yellow-500") ||
            cls.includes("amber"))
        );
      })
      .first();
    if ($statusBadge.length) {
      status = $statusBadge.text().trim() || null;
    }

    let rating = null;
    let ratingCount = null;
    const $ratingWrap = $(".text-amber-400")
      .filter((i, el) => $(el).text().includes("/10"))
      .first();
    if ($ratingWrap.length) {
      const raw = $ratingWrap.text().trim();
      const ratingMatch = raw.match(/([\d.]+)\s*\/\s*10/);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);
      const countMatch = raw.match(/\(\s*(\d+)\s*\)/);
      if (countMatch) ratingCount = parseInt(countMatch[1]);
    }

    let mangaType = null;
    const $typeSpan = $("span")
      .filter((i, el) => {
        const cls = $(el).attr("class") || "";
        return (
          cls.includes("font-black") &&
          cls.includes("uppercase") &&
          cls.includes("text-white") &&
          $(el).parent().text().trim().length < 30
        );
      })
      .first();
    if ($typeSpan.length) mangaType = $typeSpan.text().trim() || null;

    let originCode = null;
    const $originText = $("span")
      .filter((i, el) => {
        const txt = $(el).text().trim();
        return (
          /^[A-Z]{2}$/.test(txt) &&
          $(el).attr("class")?.includes("text-white/55")
        );
      })
      .first();
    if ($originText.length) originCode = $originText.text().trim();

    const genres = [];
    $('a[href^="/search?search="]').each((i, el) => {
      const txt = $(el).text().trim();
      if (txt && !genres.includes(txt)) genres.push(txt);
    });

    const authors = [];
    $('a[href^="/search?author="]').each((i, el) => {
      const txt = $(el).text().trim();
      if (txt && !authors.includes(txt)) authors.push(txt);
    });

    const artists = [];
    $('a[href^="/search?artist="]').each((i, el) => {
      const txt = $(el).text().trim();
      if (txt && !artists.includes(txt)) artists.push(txt);
    });

    const details = {};
    $("aside > div > div").each((i, el) => {
      const $el = $(el);
      const label = $el
        .find("span.font-mono")
        .first()
        .text()
        .trim()
        .toLowerCase();
      const value = $el.find("span").last().text().trim();
      if (label && value) {
        details[label] = value;
      }
    });

    const totalChapters = details.chapters
      ? parseFloat(details.chapters)
      : null;
    const lastUpdated = details.updated || null;

    const externalLinks = {};
    $('aside a[target="_blank"]').each((i, el) => {
      const $a = $(el);
      const href = $a.attr("href");
      const titleAttr = $a.attr("title");
      if (href && titleAttr) {
        externalLinks[titleAttr.toLowerCase()] = href;
      }
    });

    const relatedSeries = {};
    let currentRelatedType = null;

    $("aside div").each((i, el) => {
      const $el = $(el);
      const cls = $el.attr("class") || "";

      if (
        cls.includes("text-[10px]") &&
        cls.includes("font-bold") &&
        cls.includes("uppercase") &&
        cls.includes("tracking-wider")
      ) {
        const label = $el.text().trim().toLowerCase().replace(/\s+/g, "_");
        if (label) {
          currentRelatedType = label;
          if (!relatedSeries[currentRelatedType])
            relatedSeries[currentRelatedType] = [];
        }
      }
    });

    $("aside")
      .find("div")
      .filter((i, el) => {
        const txt = $(el).text().trim();
        return (
          $(el)
            .find("p")
            .filter((j, p) => $(p).text().includes("Related Series")).length > 0
        );
      })
      .find("> div")
      .each((i, sectionEl) => {
        const $section = $(sectionEl);
        const typeLabel = $section
          .find(".uppercase.tracking-wider")
          .first()
          .text()
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");
        if (!typeLabel) return;

        if (!relatedSeries[typeLabel]) relatedSeries[typeLabel] = [];

        $section.find('a[href^="/manga/"]').each((j, aEl) => {
          const $a = $(aEl);
          const href = $a.attr("href") || "";
          const relatedIdMatch = href.match(/\/manga\/(\d+)/);
          if (!relatedIdMatch) return;

          const relatedId = relatedIdMatch[1];
          const statusMatch = $a
            .find(".text-white\\/30")
            .text()
            .trim()
            .replace(/^·\s*/, "");
          const cloned = $a.clone();
          cloned.find(".text-white\\/30").remove();
          const relatedTitle = cloned.text().trim();

          relatedSeries[typeLabel].push({
            id: relatedId,
            title: relatedTitle,
            url: BASE_URL + href,
            status: statusMatch || null,
          });
        });
      });

    const otherNames = [];
    $("button")
      .filter((i, el) => $(el).text().includes("Other Names"))
      .each((i, el) => {
        $(el)
          .parent()
          .find("span, a")
          .each((j, sub) => {
            const txt = $(sub).text().trim();
            if (txt && txt !== "Other Names" && !otherNames.includes(txt))
              otherNames.push(txt);
          });
      });

    let firstChapterId = null;
    const $startBtn = $('a[href^="/chapter/"]').first();
    if ($startBtn.length) {
      const href = $startBtn.attr("href") || "";
      const match = href.match(/\/chapter\/(\d+)/);
      if (match) firstChapterId = match[1];
    }

    let tagCount = null;
    const $tagsBtn = $("button")
      .filter((i, el) => $(el).text().trim().startsWith("Tags"))
      .first();
    if ($tagsBtn.length) {
      const countText = $tagsBtn.find("span").last().text().trim();
      if (countText) tagCount = parseInt(countText);
    }

    res.json({
      data: {
        id,
        title,
        url,
        cover,
        description,
        status,
        rating,
        ratingCount,
        type: mangaType,
        origin: originCode,
        genres,
        authors,
        artists,
        totalChapters,
        lastUpdated,
        firstChapterId,
        tagCount,
        externalLinks,
        relatedSeries,
      },
    });
  } catch (error) {
    console.error("[MangaDotNet Info] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch manga info",
      message: error.message,
    });
  }
});

module.exports = router;
