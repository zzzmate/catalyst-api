const express = require("express");
const axios = require("axios");
const router = express.Router();
const {
  BASE_URL,
  normalizeTypes,
  normalizeStatuses,
  normalizeGenres,
  prefixImageUrls,
} = require("./utils");

const SEARCH_API = "https://atsu.moe/collections/manga/documents/search";

function buildFilterBy({
  includeGenres,
  excludeGenres,
  types,
  statuses,
  isAdult,
}) {
  const parts = [];

  if (includeGenres && includeGenres.length > 0) {
    includeGenres.forEach((g) => {
      parts.push(`genreIds:=\`${g}\``);
    });
  }

  if (excludeGenres && excludeGenres.length > 0) {
    parts.push(
      `genreIds:!=[${excludeGenres.map((g) => `\`${g}\``).join(",")}]`,
    );
  }

  if (types && types.length > 0) {
    parts.push(`type:=[${types.map((t) => `\`${t}\``).join(",")}]`);
  }

  if (statuses && statuses.length > 0) {
    parts.push(`status:=[${statuses.map((s) => `\`${s}\``).join(",")}]`);
  }

  if (isAdult === false) {
    parts.push("isAdult:=false");
  } else if (isAdult === true) {
    parts.push("isAdult:=true");
  }

  parts.push("views:>0");
  parts.push("hidden:!=true");

  return parts.join(" && ");
}

function splitToArray(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  return String(str).split(",").filter(Boolean);
}

router.get("/", async (req, res) => {
  const search = (req.query.search || req.query.q || "").trim();
  const typesRaw = normalizeTypes(req.query.types);
  const statusesRaw = normalizeStatuses(req.query.status || req.query.statuses);
  const genresRaw = normalizeGenres(req.query.genres || req.query.genre);
  const excludeGenresRaw = normalizeGenres(
    req.query.excludeGenres || req.query.exclude_genres,
  );
  const page = parseInt(req.query.page) || 1;
  const perPage =
    parseInt(req.query.limit) || parseInt(req.query.per_page) || 40;
  const adult = req.query.adult === "1" || req.query.adult === "true";

  try {
    const types = splitToArray(typesRaw);
    const statuses = splitToArray(statusesRaw);
    const includeGenres = splitToArray(genresRaw);
    const excludeGenres = splitToArray(excludeGenresRaw);

    const filterBy = buildFilterBy({
      includeGenres,
      excludeGenres,
      types,
      statuses,
      isAdult: adult ? undefined : false,
    });

    const params = {
      q: search || "*",
      query_by: "title,englishTitle,otherNames,authors,acronyms",
      query_by_weights: "4,3,2,1,1",
      num_typos: "4,3,2,1,0",
      prefix: "true,true,true,true,false",
      include_fields:
        "id,title,englishTitle,poster,posterSmall,posterMedium,type,isAdult,status,year,mbRating,popularity,dateAdded",
      filter_by: filterBy,
      page,
      per_page: perPage,
      infix: "off,off,fallback,off,off",
    };

    console.log("[AtsuMoe Browse] Fetching:", SEARCH_API, params);

    const response = await axios.get(SEARCH_API, {
      params,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: `${BASE_URL}/explore`,
      },
    });

    res.json(prefixImageUrls(response.data));
  } catch (error) {
    console.error("[AtsuMoe Browse] Error:", error.message);
    if (error.response) {
      console.error("[AtsuMoe Browse] Response data:", error.response.data);
    }
    res.status(500).json({
      error: "Failed to browse",
      message: error.message,
      details: error.response?.data || null,
    });
  }
});

module.exports = router;
