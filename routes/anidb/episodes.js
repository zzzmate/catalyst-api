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
    const { ep } = req.query;

    if (!fullSlug || !fullSlug.match(/^.+-\d+$/)) {
      return res.status(400).json({
        error:
          "Invalid slug format. Expected: anime-name-id (e.g., tokyo-ghoul-5740)",
      });
    }

    const slugMatch = fullSlug.match(/^(.+)-(\d+)$/);
    const slug = slugMatch ? slugMatch[1] : fullSlug;
    const animeId = slugMatch ? slugMatch[2] : null;
    const animeUrl = `${BASE_URL}/anime/${fullSlug}`;
    const targetEp = ep ? parseInt(ep) : null;

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

    const alpineEpisodes = Array.isArray(alpineData?.allEpisodes)
      ? alpineData.allEpisodes
      : [];

    let episodesFromHtml = [];
    if (alpineEpisodes.length === 0) {
      const html = await page.content();
      const $ = cheerio.load(html);
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
    }

    const allEpisodes =
      alpineEpisodes.length > 0
        ? alpineEpisodes.map((ep) => ({
            id: ep.id || null,
            number: ep.number || ep.num || ep.episode || null,
            title: ep.title || ep.name || null,
            filler: ep.filler || false,
            slug: ep.slug || null,
          }))
        : episodesFromHtml;

    const languages = Array.isArray(alpineData?.languages)
      ? alpineData.languages
      : [];

    let languagesFromHtml = [];
    if (languages.length === 0) {
      const html = await page.content();
      const $ = cheerio.load(html);
      $('[x-text="lang.name"]').each((i, el) => {
        const name = $(el).text().trim();
        if (name)
          languagesFromHtml.push({
            code: name.toLowerCase().substring(0, 2),
            name,
          });
      });
    }

    const availableLanguages =
      languages.length > 0 ? languages : languagesFromHtml;

    if (!targetEp) {
      await browser.close();
      return res.json({
        id: animeId,
        slug,
        fullSlug,
        totalEpisodes: allEpisodes.length,
        hasFillers: allEpisodes.some((ep) => ep.filler),
        languages: availableLanguages,
        episodes: allEpisodes,
      });
    }

    const targetEpisode = allEpisodes.find((e) => {
      const num = parseInt(e.number);
      return num === targetEp;
    });

    if (!targetEpisode) {
      await browser.close();
      return res.status(404).json({
        error: `Episode ${targetEp} not found`,
        availableEpisodes: allEpisodes.map((e) => e.number),
      });
    }

    const targetIndex = allEpisodes.indexOf(targetEpisode);
    const hasPrevEpisode = targetIndex > 0;
    const hasNextEpisode = targetIndex < allEpisodes.length - 1;
    const prevEpisode = hasPrevEpisode ? allEpisodes[targetIndex - 1] : null;
    const nextEpisode = hasNextEpisode ? allEpisodes[targetIndex + 1] : null;

    const buttons = await page.$$('[x-ref="episodesGrid"] button, [data-epid]');
    let clicked = false;

    for (const btn of buttons) {
      const btnText = await page.evaluate((el) => el.textContent.trim(), btn);
      const btnEpId = await page.evaluate(
        (el) => el.getAttribute("data-epid"),
        btn,
      );

      if (
        parseInt(btnText) === targetEp ||
        (targetEpisode.id && btnEpId === String(targetEpisode.id))
      ) {
        await btn.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      await browser.close();
      return res
        .status(500)
        .json({ error: `Could not click episode ${targetEp}` });
    }

    await new Promise((r) => setTimeout(r, 3000));

    const embedSrc = await page.evaluate(() => {
      try {
        const watchEl = document.querySelector("[x-data*='watchPage']");
        if (watchEl && window.Alpine) {
          return Alpine.$data(watchEl).embedSrc || null;
        }
        if (watchEl && watchEl.__x) {
          return watchEl.__x.$data.embedSrc || null;
        }
        const iframe = document.querySelector('[x-ref="playerFrame"]');
        if (iframe) return iframe.src || iframe.getAttribute("src") || null;
      } catch (e) {}
      return null;
    });

    if (!embedSrc || !embedSrc.startsWith("http")) {
      await browser.close();
      return res.json({
        id: animeId,
        slug,
        fullSlug,
        episode: targetEpisode,
        hasPrevEpisode,
        hasNextEpisode,
        prevEpisode: prevEpisode ? prevEpisode.number : null,
        nextEpisode: nextEpisode ? nextEpisode.number : null,
        languages: availableLanguages,
        stream: null,
        error: "Could not get embed URL",
      });
    }

    const streamPage = await browser.newPage();
    const m3u8Urls = [];

    await streamPage.setRequestInterception(true);
    streamPage.on("request", (request) => request.continue());
    streamPage.on("response", async (response) => {
      const url = response.url();
      if (
        url.includes(".m3u8") &&
        !url.includes("ping.gif") &&
        url.startsWith("https://hls.anidb.app/") &&
        !m3u8Urls.includes(url)
      ) {
        m3u8Urls.push(url);
      }
    });

    await streamPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    await streamPage.goto(embedSrc, {
      waitUntil: "networkidle2",
      timeout: 20000,
    });
    await new Promise((r) => setTimeout(r, 3000));
    await streamPage.close();
    await browser.close();
    browser = null;

    const masterUrl = m3u8Urls.find((u) => u.includes("master.m3u8")) || null;

    let qualities = [];
    if (masterUrl) {
      const base = masterUrl.split("master.m3u8")[0];
      qualities = [
        { quality: "master", url: masterUrl },
        { quality: "1080p", url: `${base}index-f1-v1-a1.m3u8` },
        { quality: "720p", url: `${base}index-f2-v1-a1.m3u8` },
        { quality: "360p", url: `${base}index-f3-v1-a1.m3u8` },
      ];
    }

    res.json({
      id: animeId,
      slug,
      fullSlug,
      episode: targetEpisode,
      hasPrevEpisode,
      hasNextEpisode,
      prevEpisode: prevEpisode ? prevEpisode.number : null,
      nextEpisode: nextEpisode ? nextEpisode.number : null,
      languages: availableLanguages,
      stream: {
        embedUrl: embedSrc,
        master: masterUrl,
        qualities,
      },
    });
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    res
      .status(500)
      .json({ error: "Failed to fetch episodes", message: error.message });
  }
});

module.exports = router;
