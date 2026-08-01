const express = require("express");
const cheerio = require("cheerio");
const router = express.Router();
const {
  BASE_URL,
  extractSlug,
  absoluteUrl,
  fetchPage,
  isCacheValid,
  getCachedData,
  saveCachedData,
} = require("./utils");

router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const cacheKey = slug;

  if (isCacheValid("info", cacheKey)) {
    const cached = getCachedData("info", cacheKey);
    if (cached) return res.json({ cached: true, ...cached });
  }

  try {
    const url = `${BASE_URL}/read-manga/${slug}/`;
    console.log("[Mangago Info] Fetching:", url);
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const title = $("h1").last().text().trim() || null;
    const $cover = $(".cover img").first();
    const cover = $cover.attr("src") || null;

    let status = null;
    $("label").each((i, el) => {
      if ($(el).text().trim() === "Status:") {
        const $span = $(el).parent().find("span").first();
        if ($span.length) {
          status = $span.text().trim();
          const style = $span.attr("style") || "";
          if (style.includes("manga_closed")) status = "Completed";
          else if (style.includes("manga_opened")) status = "Ongoing";
        }
      }
    });

    const authors = [];
    $("label").each((i, el) => {
      if ($(el).text().trim() === "Author:") {
        $(el)
          .parent()
          .find("a")
          .each((j, a) => {
            const name = $(a).text().trim();
            if (name) authors.push(name);
          });
      }
    });

    const genres = [];
    $("label").each((i, el) => {
      if ($(el).text().trim().startsWith("Genre")) {
        $(el)
          .parent()
          .find("a")
          .each((j, a) => {
            const name = $(a).text().trim();
            if (name) genres.push(name);
          });
      }
    });

    let alternative = null;
    $("label").each((i, el) => {
      if ($(el).text().trim().startsWith("Alternative")) {
        const altText = $(el).parent().text().replace($(el).text(), "").trim();
        if (altText)
          alternative = altText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      }
    });

    const summary = $(".manga_summary").first().text().trim() || null;

    let rating = null;
    const $ratingNum = $(".rating_num").first();
    if ($ratingNum.length) {
      const parsed = parseFloat($ratingNum.text().trim());
      if (!isNaN(parsed)) rating = parsed;
    }

    let ratingCount = null;
    const $voted = $('a[href*="/home/manga/status/"]').first();
    if ($voted.length) {
      const match = $voted.text().match(/(\d+)\s*voted/);
      if (match) ratingCount = parseInt(match[1]);
    }

    const ratingBreakdown = [];
    $(".rating_wrap .stars9").each((i, el) => {
      const $el = $(el);
      const alt = $el.attr("alt") || $el.attr("title");
      if (!alt) return;
      const $parent = $el.closest('div[style*="clear:both"]');
      const percentText = $parent.find("span").last().text().trim();
      const percentMatch = percentText.match(/([\d.]+)%/);
      if (percentMatch) {
        ratingBreakdown.push({
          label: alt,
          percent: parseFloat(percentMatch[1]),
        });
      }
    });

    let startReadingUrl = null;
    const $startBtn = $("a.content-h1-btn.yellow").first();
    if ($startBtn.length) {
      startReadingUrl = absoluteUrl($startBtn.attr("href") || "");
    }

    const latestChapters = [];
    $("label").each((i, el) => {
      if ($(el).text().trim().startsWith("Latest")) {
        $(el)
          .parent()
          .find("a.chico")
          .each((j, a) => {
            const $a = $(a);
            latestChapters.push({
              label: $a.text().trim(),
              url: absoluteUrl($a.attr("href") || ""),
            });
          });
      }
    });

    const chapters = [];
    $("#chapter_table tr").each((i, tr) => {
      const $tr = $(tr);
      const $a = $tr.find("a.chico").first();
      if (!$a.length) return;

      const chUrl = $a.attr("href") || "";
      const rawLabel = $a.find("b").text().trim();
      const fullText = $a.text().trim();
      const titleText = fullText
        .replace(rawLabel, "")
        .replace(/^\s*:\s*/, "")
        .trim();
      const dateText = $tr.find("td.no").last().text().trim();

      let number = null;
      const numMatch = rawLabel.match(/Ch\.(\d+(?:\.\d+)?)/i);
      if (numMatch) number = parseFloat(numMatch[1]);

      chapters.push({
        label: rawLabel,
        title: titleText || null,
        number,
        url: absoluteUrl(chUrl),
        date: dateText || null,
      });
    });

    const photos = [];
    $(".mangaphotolist img").each((i, el) => {
      const src = $(el).attr("src");
      if (src && !src.includes("loading")) photos.push(src);
    });

    const relatedManga = [];
    const seenRelated = new Set();

    $("h4").each((i, el) => {
      const headerText = $(el).text().trim();
      if (!headerText.includes("same author")) return;

      const $picList = $(el).closest(".also_like").next(".pic_list");
      if (!$picList.length) return;

      $picList.find(".listitem").each((j, item) => {
        const $item = $(item);
        const $mainLink = $item.find(".left a").first();
        const mangaUrl = $mainLink.attr("href") || "";
        const relSlug = extractSlug(mangaUrl);
        if (!relSlug || seenRelated.has(relSlug)) return;
        seenRelated.add(relSlug);

        const $img = $item.find("img").first();
        let relCover = $img.attr("data-src") || $img.attr("src") || null;
        if (relCover && relCover.includes("base64"))
          relCover = $img.attr("data-src") || null;

        const $titleLink = $item.find(".title a").first();
        const relTitle = $titleLink.attr("title") || $titleLink.text().trim();
        const isCompleted = ($titleLink.attr("style") || "").includes(
          "manga_closed",
        );

        relatedManga.push({
          slug: relSlug,
          title: relTitle,
          url: absoluteUrl(mangaUrl),
          cover: relCover,
          isCompleted,
        });
      });
    });

    const data = {
      data: {
        slug,
        title,
        url,
        cover,
        summary,
        status,
        rating,
        ratingCount,
        ratingBreakdown:
          ratingBreakdown.length > 0 ? ratingBreakdown : undefined,
        startReadingUrl,
        authors,
        genres,
        alternative,
        latestChapters,
        totalChapters: chapters.length,
        chapters,
        photos: photos.length > 0 ? photos : undefined,
        relatedManga: relatedManga.length > 0 ? relatedManga : undefined,
      },
    };

    saveCachedData("info", cacheKey, data);
    res.json({ cached: false, ...data });
  } catch (error) {
    console.error("[Mangago Info] Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch manga info", message: error.message });
  }
});

module.exports = router;
