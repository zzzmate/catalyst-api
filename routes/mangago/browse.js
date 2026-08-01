const express = require("express");
const cheerio = require("cheerio");
const router = express.Router();
const { BASE_URL, extractSlug, absoluteUrl, fetchPage } = require("./utils");

const SORT_MAP = {
  views: "view",
  popularity: "comment_count",
  created: "create_date",
  updated: "update_date",
};

router.get("/", async (req, res) => {
  const genres = (req.query.genres || req.query.genre || "").trim();
  const exclude = (req.query.exclude || req.query.e || "").trim();
  const search = (
    req.query.q ||
    req.query.search ||
    req.query.text ||
    ""
  ).trim();
  const finished =
    req.query.finished !== "0" && req.query.finished !== "false" ? "1" : "0";
  const ongoing =
    req.query.ongoing !== "0" && req.query.ongoing !== "false" ? "1" : "0";
  const sortBy = SORT_MAP[req.query.sort] || req.query.sortby || null;
  const page = parseInt(req.query.page) || 1;

  try {
    let url;

    if (search) {
      url = `${BASE_URL}/r/l_search/?name=${encodeURIComponent(search)}&page=${page}`;
    } else if (genres) {
      const genrePath = genres
        .split(",")
        .map((g) => g.trim())
        .join(",");
      url = `${BASE_URL}/genre/${genrePath}/${page > 1 ? page + "/" : ""}?f=${finished}&o=${ongoing}`;
      if (exclude) url += `&e=${exclude}`;
      if (sortBy) url += `&sortby=${sortBy}`;
    } else {
      let listType = "all";
      if (finished === "1" && ongoing === "0") listType = "completed";
      else if (finished === "0" && ongoing === "1") listType = "ongoing";

      if (sortBy === "view") {
        url = `${BASE_URL}/list/topview/${listType}/${page}/`;
      } else if (sortBy === "comment_count") {
        url = `${BASE_URL}/list/comment/${listType}/${page}/`;
      } else if (sortBy === "create_date") {
        url = `${BASE_URL}/list/create/${listType}/${page}/`;
      } else {
        url = `${BASE_URL}/list/latest/${listType}/${page}/`;
      }
    }

    console.log("[Mangago Browse] Fetching:", url);
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const items = [];
    const seenSlugs = new Set();

    if (search) {
      $(
        "#search_list .updatesli, #search_list .listitem, .pic_list .listitem, .updatesli",
      ).each((i, el) => {
        const $el = $(el);
        let mangaUrl = "";
        let title = "";
        let cover = null;

        const $titleLink = $el.find(".title a, h3 a, .manga_title a").first();
        const $imgLink = $el.find(".left a, a.thm-effect").first();
        const $img = $el.find("img").first();

        if ($titleLink.length) {
          title = $titleLink.attr("title") || $titleLink.text().trim();
          mangaUrl = $titleLink.attr("href") || "";
        }
        if (!mangaUrl && $imgLink.length) {
          mangaUrl = $imgLink.attr("href") || "";
          if (!title) title = $imgLink.attr("title") || "";
        }

        cover = $img.attr("data-src") || $img.attr("src") || null;
        if (cover && cover.includes("base64"))
          cover = $img.attr("data-src") || null;

        const slug = extractSlug(mangaUrl);
        if (!slug || seenSlugs.has(slug)) return;
        seenSlugs.add(slug);

        items.push({
          slug,
          title: title || slug,
          url: absoluteUrl(mangaUrl),
          cover,
        });
      });

      if (items.length === 0) {
        $('a[href*="/read-manga/"]').each((i, el) => {
          const $a = $(el);
          const href = $a.attr("href") || "";
          const slug = extractSlug(href);
          if (!slug || seenSlugs.has(slug)) return;
          seenSlugs.add(slug);

          const $img = $a.find("img").first();
          const cover = $img.attr("data-src") || $img.attr("src") || null;
          const title =
            $a.attr("title") ||
            $img.attr("title") ||
            $img.attr("alt") ||
            $a.text().trim();

          if (!title || title.length < 2) return;

          items.push({
            slug,
            title,
            url: absoluteUrl(href),
            cover: cover && !cover.includes("base64") ? cover : null,
          });
        });
      }
    } else {
      $("#left_side .listitem, .pic_list .listitem").each((i, el) => {
        const $el = $(el);
        const $mainLink = $el.find(".left a").first();
        const mangaUrl = $mainLink.attr("href") || "";
        const slug = extractSlug(mangaUrl);

        if (!slug || seenSlugs.has(slug)) return;
        seenSlugs.add(slug);

        const $img = $el.find("img").first();
        let cover = $img.attr("data-src") || $img.attr("src") || null;
        if (cover && cover.includes("base64"))
          cover = $img.attr("data-src") || null;

        const $titleLink = $el.find(".title a").first();
        const title = $titleLink.attr("title") || $titleLink.text().trim();
        const titleStyle = $titleLink.attr("style") || "";
        const isCompleted = titleStyle.includes("manga_closed");

        items.push({
          slug,
          title,
          url: absoluteUrl(mangaUrl),
          cover,
          isCompleted,
        });
      });
    }

    let totalPages = page;
    const $pagination = $(".pagination");
    if ($pagination.length) {
      const totalAttr = $pagination.attr("total");
      if (totalAttr) totalPages = parseInt(totalAttr);

      if (!totalAttr) {
        $pagination.find("a").each((i, a) => {
          const match = $(a)
            .attr("title")
            ?.match(/Page\s+(\d+)/i);
          if (match) {
            const num = parseInt(match[1]);
            if (num > totalPages) totalPages = num;
          }
        });
        $pagination.find("option").each((i, opt) => {
          const num = parseInt($(opt).text().trim());
          if (!isNaN(num) && num > totalPages) totalPages = num;
        });
      }
    }
    if (totalPages < page) totalPages = page;
    const hasNextPage = page < totalPages;

    const availableGenres = [];
    $("#genre_panel .genre_select_div").each((i, el) => {
      const $a = $(el);
      const name = ($a.attr("_id") || "").trim();
      const countMatch = $a
        .find("span")
        .text()
        .match(/\[(\d+)\]/);
      const count = countMatch ? parseInt(countMatch[1]) : null;
      const isIncluded = $a.hasClass("include");
      const isExcluded = $a.hasClass("exclude");
      if (name) {
        availableGenres.push({
          name,
          count,
          included: isIncluded,
          excluded: isExcluded,
        });
      }
    });

    res.json({
      query: {
        search: search || null,
        genres: genres || null,
        exclude: exclude || null,
        finished: finished === "1",
        ongoing: ongoing === "1",
        sort: req.query.sort || null,
        page,
      },
      items,
      total: items.length,
      pagination: {
        currentPage: page,
        totalPages,
        hasNextPage,
      },
      availableGenres: availableGenres.length > 0 ? availableGenres : undefined,
    });
  } catch (error) {
    console.error("[Mangago Browse] Error:", error.message);
    res.status(500).json({
      error: "Failed to browse",
      message: error.message,
    });
  }
});

module.exports = router;
