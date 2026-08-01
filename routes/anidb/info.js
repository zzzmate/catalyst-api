const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const router = express.Router();

puppeteer.use(StealthPlugin());

const BASE_URL = "https://anidb.app";

router.get("/:fullSlug", async (req, res) => {
  let browser;

  try {
    const { fullSlug } = req.params;

    if (!fullSlug || !fullSlug.match(/^.+-\d+$/)) {
      return res.status(400).json({
        error:
          "Invalid slug format. Expected format: anime-name-id (e.g., tokyo-ghoul-5740)",
      });
    }

    const slugMatch = fullSlug.match(/^(.+)-(\d+)$/);
    const slug = slugMatch ? slugMatch[1] : fullSlug;
    const animeId = slugMatch ? slugMatch[2] : null;
    const animeUrl = `${BASE_URL}/anime/${fullSlug}`;

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (request) => request.continue());

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    await page.goto(animeUrl, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 4000));

    const alpineData = await page.evaluate(() => {
      try {
        const watchEl = document.querySelector("[x-data*='watchPage']");
        if (watchEl && watchEl.__x) {
          const data = watchEl.__x.$data || watchEl.__x.getUnobservedData();
          return {
            allEpisodes: data.allEpisodes || [],
            languages: data.languages || [],
            currentLang: data.currentLang || null,
          };
        }
        if (watchEl && window.Alpine) {
          const d = Alpine.$data(watchEl);
          return {
            allEpisodes: d.allEpisodes || [],
            languages: d.languages || [],
            currentLang: d.currentLang || null,
          };
        }
      } catch (e) {
        return { error: e.message };
      }
      return null;
    });

    const html = await page.content();
    await browser.close();
    browser = null;

    const $ = cheerio.load(html);

    const title =
      $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      null;

    const poster =
      $('img[alt="' + title + '"]')
        .first()
        .attr("src") ||
      $(".w-40 img, .w-52 img").first().attr("src") ||
      null;

    const type = $('a[href*="type="]').first().text().trim() || null;
    const status = $('a[href*="status="]').first().text().trim() || null;

    let score = null;
    $(".badge-gray").each((i, el) => {
      const $el = $(el);
      if ($el.find(".text-yellow-400").length > 0) {
        const text = $el.clone().find("svg").remove().end().text().trim();
        const parsed = parseFloat(text);
        if (!isNaN(parsed)) {
          score = parsed;
          return false;
        }
      }
    });

    let contentRating = null;
    $(".badge-gray").each((i, el) => {
      const text = $(el).text().trim();
      if (
        text.match(/^(G|PG|PG-13|R|R\+|Rx)\s*-/i) ||
        text.match(/^(G|PG|PG-13)\s*$/i)
      ) {
        contentRating = text;
        return false;
      }
    });

    let demographic = null;
    $('a[href*="/demographics/"]').each((i, el) => {
      demographic = { name: $(el).text().trim(), url: $(el).attr("href") };
      return false;
    });

    let season = null;
    $('a[href*="season="]').each((i, el) => {
      season = $(el).text().trim();
      return false;
    });

    let duration = null;
    $(".text-sm.text-faint, .flex-wrap span").each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/^\d+m$/)) {
        duration = text;
        return false;
      }
    });
    if (!duration) {
      $("dt").each((i, el) => {
        if ($(el).text().trim() === "Duration") {
          duration = $(el).next("dd").text().trim();
          return false;
        }
      });
    }

    let aired = null;
    $("dt").each((i, el) => {
      if ($(el).text().trim() === "Aired") {
        aired = $(el).next("dd").text().trim();
        return false;
      }
    });

    const genres = [];
    $('a[href*="/genres/"]').each((i, el) => {
      const href = $(el).attr("href") || "";
      const idMatch = href.match(/\/genres\/(\d+)/);
      const name = $(el).text().trim();
      if (idMatch && name && !genres.find((g) => g.id === idMatch[1])) {
        genres.push({ id: idMatch[1], name, url: href });
      }
    });

    const themes = [];
    $('a[href*="/themes/"]').each((i, el) => {
      const href = $(el).attr("href") || "";
      const idMatch = href.match(/\/themes\/(\d+)/);
      const name = $(el).text().trim();
      if (idMatch && name && !themes.find((t) => t.id === idMatch[1])) {
        themes.push({ id: idMatch[1], name, url: href });
      }
    });

    const studios = [];
    $('a[href*="/studios/"]').each((i, el) => {
      const href = $(el).attr("href") || "";
      const idMatch = href.match(/\/studios\/(\d+)/);
      const name = $(el).text().trim();
      if (idMatch && name && !studios.find((s) => s.id === idMatch[1])) {
        studios.push({ id: idMatch[1], name, url: href });
      }
    });

    let synopsis = null;
    const synopsisHeader = $("h2")
      .filter((i, el) => $(el).text().trim() === "Synopsis")
      .first();
    if (synopsisHeader.length) {
      synopsis =
        synopsisHeader.parent().find("p").first().text().trim() || null;
    }

    let synonyms = [];
    $("dt").each((i, el) => {
      if ($(el).text().trim() === "Synonyms") {
        const synText = $(el).next("dd").text().trim();
        if (synText) {
          synonyms = synText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return false;
      }
    });

    let trailer = null;
    $('a[href*="youtube.com/watch"]').each((i, el) => {
      const href = $(el).attr("href");
      if (href) {
        const videoIdMatch = href.match(/[?&]v=([^&]+)/);
        trailer = {
          url: href,
          videoId: videoIdMatch ? videoIdMatch[1] : null,
          site: "YouTube",
        };
        return false;
      }
    });

    const externalLinks = [];
    const externalSites = {
      myanimelist: { name: "MyAnimeList", key: "mal" },
      anilist: { name: "AniList", key: "anilist" },
      "anidb.net": { name: "AniDB", key: "anidb" },
      kitsu: { name: "Kitsu", key: "kitsu" },
    };

    $('a[target="_blank"][rel*="noopener"]').each((i, el) => {
      const href = $(el).attr("href") || "";
      for (const [domain, info] of Object.entries(externalSites)) {
        if (href.includes(domain)) {
          const idMatch = href.match(
            /\/(\d+)\/?$|\/anime\/(\d+)|\/anime\/([^/]+)/,
          );
          externalLinks.push({
            site: info.name,
            key: info.key,
            url: href,
            id: idMatch ? idMatch[1] || idMatch[2] || idMatch[3] : null,
          });
          break;
        }
      }
    });

    const seasons = [];
    const seasonsSection = $("h3")
      .filter((i, el) => $(el).text().trim() === "Seasons")
      .first()
      .closest(".bg-card");

    if (seasonsSection.length) {
      seasonsSection.find("a[href*='/anime/']").each((i, el) => {
        const $a = $(el);
        const href = $a.attr("href") || "";
        const seasonTitle = $a.attr("title") || "";
        const urlMatch = href.match(/\/anime\/([^#?]+)/);
        if (!urlMatch) return;

        const sFullSlug = urlMatch[1];
        const sSlugMatch = sFullSlug.match(/^(.+)-(\d+)$/);
        const sPoster = $a.find("img").attr("src") || null;

        let seasonNumber = null;
        const numBadge = $a.find("span.absolute.top-2.left-2");
        if (numBadge.length) {
          seasonNumber = parseInt(numBadge.text().trim()) || null;
        }

        const isCurrent =
          $a.hasClass("pointer-events-none") ||
          $a.find(".border-orange").length > 0 ||
          sFullSlug === fullSlug;

        let sYear = null;
        const yearText = $a.find(".text-faint span").last().text().trim();
        if (yearText && /^\d{4}$/.test(yearText)) sYear = yearText;

        seasons.push({
          number: seasonNumber,
          title: seasonTitle,
          fullSlug: sFullSlug,
          id: sSlugMatch ? sSlugMatch[2] : null,
          slug: sSlugMatch ? sSlugMatch[1] : sFullSlug,
          url: href.startsWith("http") ? href : BASE_URL + href,
          poster: sPoster,
          year: sYear,
          isCurrent,
        });
      });
    }

    const relations = {};
    const relationsSection = $("h3")
      .filter((i, el) => $(el).text().trim() === "Relations")
      .first()
      .closest(".bg-card");

    if (relationsSection.length) {
      relationsSection.find('[x-show*="activeRel"]').each((i, el) => {
        const xShow = $(el).attr("x-show") || "";
        const typeMatch = xShow.match(/activeRel\s*===\s*'([^']+)'/);
        if (!typeMatch) return;

        const relationType = typeMatch[1];
        const relItems = [];

        $(el)
          .find("a.anime-card")
          .each((j, cardEl) => {
            const $card = $(cardEl);
            const href = $card.attr("href") || "";
            const cardTitle = $card.attr("title") || "";
            const urlMatch = href.match(/\/anime\/([^#?]+)/);
            if (!urlMatch) return;

            const rFullSlug = urlMatch[1];
            const rSlugMatch = rFullSlug.match(/^(.+)-(\d+)$/);
            const rPoster = $card.find("img").attr("src") || null;

            let rType = null;
            const $typeBadge = $card.find(".badge-orange").first();
            if ($typeBadge.length) rType = $typeBadge.text().trim();

            let rRating = null;
            $card.find(".badge-gray").each((k, badge) => {
              if ($(badge).find(".text-yellow-400").length > 0) {
                const rText = $(badge)
                  .clone()
                  .find("svg")
                  .remove()
                  .end()
                  .text()
                  .trim();
                const parsed = parseFloat(rText);
                if (!isNaN(parsed)) rRating = parsed;
              }
            });

            relItems.push({
              title: cardTitle,
              fullSlug: rFullSlug,
              id: rSlugMatch ? rSlugMatch[2] : null,
              slug: rSlugMatch ? rSlugMatch[1] : rFullSlug,
              url: href.startsWith("http") ? href : BASE_URL + href,
              poster: rPoster,
              type: rType,
              rating: rRating,
            });
          });

        if (relItems.length > 0) {
          relations[relationType] = relItems;
        }
      });
    }

    const recommendations = [];

    const collectRecs = ($cards) => {
      $cards.each((i, el) => {
        const $card = $(el);
        const href = $card.attr("href") || "";
        const cardTitle = $card.attr("title") || "";
        const urlMatch = href.match(/\/anime\/([^#?]+)/);
        if (!urlMatch) return;

        const rFullSlug = urlMatch[1];
        const rSlugMatch = rFullSlug.match(/^(.+)-(\d+)$/);
        const rPoster = $card.find("img").attr("src") || null;

        let rType = null;
        const $typeBadge = $card.find(".badge-orange").first();
        if ($typeBadge.length) rType = $typeBadge.text().trim();

        let rRating = null;
        $card.find(".badge-gray").each((k, badge) => {
          if ($(badge).find(".text-yellow-400").length > 0) {
            const rText = $(badge)
              .clone()
              .find("svg")
              .remove()
              .end()
              .text()
              .trim();
            const parsed = parseFloat(rText);
            if (!isNaN(parsed)) rRating = parsed;
          }
        });

        recommendations.push({
          title: cardTitle,
          fullSlug: rFullSlug,
          id: rSlugMatch ? rSlugMatch[2] : null,
          slug: rSlugMatch ? rSlugMatch[1] : rFullSlug,
          url: href.startsWith("http") ? href : BASE_URL + href,
          poster: rPoster,
          type: rType,
          rating: rRating,
        });
      });
    };

    const recHeader = $("h2")
      .filter((i, el) => $(el).text().includes("You Might Also Like"))
      .first();
    if (recHeader.length) {
      collectRecs(recHeader.next(".anime-grid").find("a.anime-card"));
      if (recommendations.length === 0) {
        collectRecs(recHeader.parent().find("a.anime-card"));
      }
    }

    const episodesFromHtml = [];
    $('[x-ref="episodesGrid"] button, [data-epid]').each((i, el) => {
      const $btn = $(el);
      const epId = $btn.attr("data-epid") || null;
      const epTitle = $btn.attr("title") || "";
      const epNumber = $btn.text().trim();
      const isFiller =
        $btn.attr(":class")?.includes("filler") &&
        $btn.hasClass("bg-[#2a1a0a]");
      if (epId || epNumber) {
        episodesFromHtml.push({
          id: epId ? parseInt(epId) : null,
          number: parseInt(epNumber) || epNumber,
          title: epTitle,
          filler: isFiller || false,
        });
      }
    });

    let totalEpisodes = null;
    $('[x-text*="allEpisodes.length"]').each((i, el) => {
      const text = $(el).text().trim();
      const match = text.match(/(\d+)\s*episode/);
      if (match) {
        totalEpisodes = parseInt(match[1]);
        return false;
      }
    });

    const alpineEpisodes = Array.isArray(alpineData?.allEpisodes)
      ? alpineData.allEpisodes
      : [];

    const episodes =
      alpineEpisodes.length > 0
        ? alpineEpisodes.map((ep) => ({
            id: ep.id || null,
            number: ep.number || ep.num || ep.episode || null,
            title: ep.title || ep.name || null,
            filler: ep.filler || false,
            slug: ep.slug || null,
            ...(ep.aired ? { aired: ep.aired } : {}),
            ...(ep.duration ? { duration: ep.duration } : {}),
          }))
        : episodesFromHtml;

    if (!totalEpisodes) totalEpisodes = episodes.length;

    const languages = Array.isArray(alpineData?.languages)
      ? alpineData.languages
      : [];

    const languagesFromHtml = [];
    $('[x-text="lang.name"]').each((i, el) => {
      const name = $(el).text().trim();
      if (name)
        languagesFromHtml.push({
          code: name.toLowerCase().substring(0, 2),
          name,
        });
    });

    const availableLanguages =
      languages.length > 0 ? languages : languagesFromHtml;
    const currentLanguage = alpineData?.currentLang || null;

    res.json({
      id: animeId,
      slug,
      fullSlug,
      url: animeUrl,
      title,
      poster,
      type,
      status,
      score,
      contentRating,
      demographic,
      season,
      duration,
      aired,
      synopsis,
      synonyms,
      trailer,
      genres,
      themes,
      studios,
      externalLinks,
      episodes: {
        total: totalEpisodes,
        hasFillers: episodes.some((ep) => ep.filler),
        languages: {
          available: availableLanguages,
          current: currentLanguage,
        },
        list: episodes,
      },
      seasons:
        seasons.length > 0
          ? {
              total: seasons.length,
              list: seasons,
              current: seasons.find((s) => s.isCurrent)?.number || null,
            }
          : null,
      relations: Object.keys(relations).length > 0 ? relations : null,
      recommendations:
        recommendations.length > 0
          ? { total: recommendations.length, list: recommendations }
          : null,
    });
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    res
      .status(500)
      .json({ error: "Failed to fetch anime info", message: error.message });
  }
});

module.exports = router;
