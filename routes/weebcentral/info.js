const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const router = express.Router();

const BASE_URL = "https://weebcentral.com";

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const url = `${BASE_URL}/series/${id}`;
    console.log("[WeebCentral Info] Fetching:", url);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
      maxRedirects: 5,
    });

    const finalUrl = response.request?.res?.responseUrl || url;
    const slugMatch = finalUrl.match(/\/series\/[^/]+\/([^/?#]+)/);
    const slug = slugMatch ? slugMatch[1] : null;

    const $ = cheerio.load(response.data);

    const title = $("h1").first().text().trim() || null;

    let fallbackCover = null;
    let normalCover = null;
    const $coverImg = $("img")
      .filter((i, el) => {
        const alt = $(el).attr("alt") || "";
        return alt.toLowerCase().includes("cover");
      })
      .first();
    if ($coverImg.length) {
      fallbackCover = $coverImg.attr("src") || null;
    }
    $("source").each((i, s) => {
      const srcset = $(s).attr("srcset");
      if (srcset && srcset.includes("/cover/normal/")) {
        normalCover = srcset.split(" ")[0];
      }
    });

    let subscriptions = null;
    const $subDiv = $('[x-text*="subscriptions"]').first();
    if ($subDiv.length) {
      const raw = $subDiv.text().trim().replace(/,/g, "");
      const parsed = parseInt(raw);
      if (!isNaN(parsed)) subscriptions = parsed;
    }

    const authors = [];
    const tags = [];
    let type = null;
    let status = null;
    let released = null;
    let officialTranslation = null;
    let animeAdaptation = null;
    let adultContent = null;
    let rssUrl = null;

    $("li").each((i, li) => {
      const $li = $(li);
      const strong = $li
        .find("strong")
        .first()
        .text()
        .trim()
        .toLowerCase()
        .replace(":", "")
        .trim();

      if (strong.startsWith("author")) {
        $li.find("a").each((j, a) => {
          const name = $(a).text().trim();
          if (name && !authors.includes(name)) authors.push(name);
        });
      } else if (strong.startsWith("tag")) {
        $li.find("a").each((j, a) => {
          const tag = $(a).text().trim();
          if (tag && !tags.includes(tag)) tags.push(tag);
        });
      } else if (strong === "type") {
        type = $li.find("a").first().text().trim() || null;
      } else if (strong === "status") {
        status = $li.find("a").first().text().trim() || null;
      } else if (strong === "released") {
        released = $li.find("span").first().text().trim() || null;
      } else if (strong === "official translation") {
        officialTranslation =
          $li.find("a").first().text().trim().toLowerCase() === "yes";
      } else if (strong === "anime adaptation") {
        animeAdaptation =
          $li.find("a").first().text().trim().toLowerCase() === "yes";
      } else if (strong === "adult content") {
        adultContent =
          $li.find("a").first().text().trim().toLowerCase() === "yes";
      } else if (strong === "rss") {
        rssUrl = $li.find("a").first().attr("href") || null;
      }
    });

    let description = null;
    const $descLi = $("li")
      .filter((i, li) => {
        return (
          $(li).find("strong").first().text().trim().toLowerCase() ===
          "description"
        );
      })
      .first();
    if ($descLi.length) {
      description = $descLi.find("p").first().text().trim() || null;
    }

    const associatedNames = [];
    const $altLi = $("li")
      .filter((i, li) => {
        return (
          $(li).find("strong").first().text().trim().toLowerCase() ===
          "associated name(s)"
        );
      })
      .first();
    if ($altLi.length) {
      $altLi.find("ul li").each((i, el) => {
        const name = $(el).text().trim();
        if (name) associatedNames.push(name);
      });
    }

    res.json({
      data: {
        id,
        slug,
        title,
        url: `${BASE_URL}/series/${id}${slug ? "/" + slug : ""}`,
        cover: {
          fallback: fallbackCover,
          normal: normalCover,
        },
        description,
        associatedNames,
        type,
        status,
        released,
        authors,
        tags,
        subscriptions,
        flags: {
          official: officialTranslation,
          anime: animeAdaptation,
          adult: adultContent,
        },
        rssUrl,
      },
    });
  } catch (error) {
    console.error("[WeebCentral Info] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch manga info",
      message: error.message,
    });
  }
});

module.exports = router;
