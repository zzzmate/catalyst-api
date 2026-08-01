const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

const BASE_URL = "https://weebcentral.com";
const SEARCH_URL = "https://weebcentral.com/search/data";

const SORT_VALUES = [
  "Best Match",
  "Alphabet",
  "Popularity",
  "Subscribers",
  "Recently Added",
  "Latest Updates",
];
const ORDER_VALUES = ["Ascending", "Descending"];
const BOOL_VALUES = ["Any", "True", "False"];
const STATUS_VALUES = ["Ongoing", "Complete", "Hiatus", "Canceled"];
const TYPE_VALUES = ["Manga", "Manhwa", "Manhua", "OEL"];

const TYPE_ALIAS = {
  manga: "Manga",
  manhwa: "Manhwa",
  manwha: "Manhwa",
  manhua: "Manhua",
  oel: "OEL",
};

const STATUS_ALIAS = {
  ongoing: "Ongoing",
  complete: "Complete",
  completed: "Complete",
  finished: "Complete",
  hiatus: "Hiatus",
  canceled: "Canceled",
  cancelled: "Canceled",
  discontinued: "Canceled",
};

function normalizeList(input, validValues, aliasMap) {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : String(input).split(",");
  const result = [];
  arr.forEach((v) => {
    const trimmed = String(v).trim();
    if (!trimmed) return;
    if (validValues && Array.isArray(validValues)) {
      if (validValues.includes(trimmed)) {
        result.push(trimmed);
        return;
      }
      if (aliasMap) {
        const mapped = aliasMap[trimmed.toLowerCase()];
        if (mapped) {
          result.push(mapped);
          return;
        }
      }
    } else {
      result.push(trimmed);
    }
  });
  return [...new Set(result)];
}

function normalizeBool(input) {
  if (!input) return "Any";
  const v = String(input).trim();
  if (BOOL_VALUES.includes(v)) return v;
  const lower = v.toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return "True";
  if (lower === "false" || lower === "0" || lower === "no") return "False";
  return "Any";
}

function normalizeSort(input) {
  if (!input) return "Alphabet";
  const v = String(input).trim();
  if (SORT_VALUES.includes(v)) return v;
  const found = SORT_VALUES.find((s) => s.toLowerCase() === v.toLowerCase());
  return found || "Alphabet";
}

function normalizeOrder(input) {
  if (!input) return "Descending";
  const v = String(input).trim();
  if (ORDER_VALUES.includes(v)) return v;
  const lower = v.toLowerCase();
  if (lower === "asc" || lower === "ascending") return "Ascending";
  if (lower === "desc" || lower === "descending") return "Descending";
  return "Descending";
}

function parseResults($) {
  const items = [];
  const seenIds = new Set();

  $("article").each((i, el) => {
    const $el = $(el);

    const $seriesLink = $el.find('a[href*="/series/"]').first();
    const seriesUrl = $seriesLink.attr("href") || "";
    const seriesMatch = seriesUrl.match(/\/series\/([^/]+)\/([^/?#]+)/);
    if (!seriesMatch) return;

    const id = seriesMatch[1];
    if (seenIds.has(id)) return;
    seenIds.add(id);

    const slug = seriesMatch[2];

    const $img = $el.find("img").first();
    const image = $img.attr("src") || null;
    const title =
      ($img.attr("alt") || "").replace(/\s+cover$/i, "").trim() || null;

    let normalImage = null;
    let smallImage = null;
    $el.find("source").each((j, s) => {
      const srcset = $(s).attr("srcset");
      const media = $(s).attr("media") || "";
      if (!srcset) return;
      const src = srcset.split(" ")[0];
      if (media.includes("768px") && !normalImage) normalImage = src;
      else if (!smallImage) smallImage = src;
    });

    let year = null;
    let status = null;
    let type = null;
    const authors = [];
    const tags = [];

    $el.find("div").each((j, div) => {
      const $div = $(div);
      const strong = $div.find("strong").first().text().trim().toLowerCase();

      if (strong === "year:") {
        year = $div.find("span").first().text().trim() || null;
      } else if (strong === "status:") {
        status = $div.find("span").first().text().trim() || null;
      } else if (strong === "type:") {
        type = $div.find("span").first().text().trim() || null;
      } else if (strong.startsWith("author")) {
        $div.find("a").each((k, a) => {
          const name = $(a).text().trim();
          if (name && !authors.includes(name)) authors.push(name);
        });
      } else if (strong.startsWith("tag")) {
        $div.find("span").each((k, s) => {
          const tag = $(s).text().trim().replace(/,$/, "").trim();
          if (tag && !tags.includes(tag)) tags.push(tag);
        });
      }
    });

    const flags = {
      official: $el.find('[data-tip="Official Translation"]').length > 0,
      anime: $el.find('[data-tip="Anime Adaptation"]').length > 0,
      adult: $el.find('[data-tip="Adult Content"]').length > 0,
    };

    items.push({
      id,
      slug,
      title,
      url: seriesUrl,
      cover: {
        fallback: image,
        small: smallImage,
        normal: normalImage,
      },
      year,
      status,
      type,
      authors,
      tags,
      flags,
    });
  });

  return items;
}

router.get("/", async (req, res) => {
  const text = (req.query.text || req.query.search || req.query.q || "").trim();
  const author = (req.query.author || "").trim();
  const sort = normalizeSort(req.query.sort);
  const order = normalizeOrder(req.query.order);
  const official = normalizeBool(req.query.official);
  const anime = normalizeBool(req.query.anime);
  const adult = normalizeBool(req.query.adult);
  const displayMode = req.query.display_mode || "Full Display";
  const includedStatus = normalizeList(
    req.query.included_status || req.query.status,
    STATUS_VALUES,
    STATUS_ALIAS,
  );
  const includedType = normalizeList(
    req.query.included_type || req.query.type,
    TYPE_VALUES,
    TYPE_ALIAS,
  );
  const includedTag = normalizeList(req.query.included_tag || req.query.tag);
  const excludedTag = normalizeList(
    req.query.excluded_tag || req.query.exclude_tag,
  );

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 32;
  const offset = (page - 1) * limit;

  try {
    const params = new URLSearchParams();
    params.append("limit", limit);
    params.append("offset", offset);
    params.append("display_mode", displayMode);
    params.append("display_mode", displayMode);
    params.append("sort", sort);
    params.append("order", order);
    params.append("official", official);
    params.append("anime", anime);
    params.append("adult", adult);
    if (text) params.append("text", text);
    if (author) params.append("author", author);
    includedStatus.forEach((s) => params.append("included_status", s));
    includedType.forEach((t) => params.append("included_type", t));
    includedTag.forEach((t) => params.append("included_tag", t));
    excludedTag.forEach((t) => params.append("excluded_tag", t));

    const url = `${SEARCH_URL}?${params.toString()}`;
    console.log("[WeebCentral Browse] Fetching:", url);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        Referer: `${BASE_URL}/search`,
      },
    });

    const $ = cheerio.load(response.data);
    const items = parseResults($);

    const hasNextPage = $('button[hx-get*="/search/data"]').length > 0;

    res.json({
      query: {
        text: text || null,
        author: author || null,
        sort,
        order,
        official,
        anime,
        adult,
        included_status: includedStatus,
        included_type: includedType,
        included_tag: includedTag,
        excluded_tag: excludedTag,
        page,
        limit,
      },
      items,
      total: items.length,
      hasNextPage,
    });
  } catch (error) {
    console.error("[WeebCentral Browse] Error:", error.message);
    res.status(500).json({
      error: "Failed to browse",
      message: error.message,
    });
  }
});

module.exports = router;
