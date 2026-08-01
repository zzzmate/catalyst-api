const express = require("express");
const axios = require("axios");
const router = express.Router();
const { BASE_URL, prefixImageUrls } = require("./utils");

const INFO_API = "https://atsu.moe/api/manga/page";

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    console.log("[AtsuMoe Info] Fetching:", INFO_API, { id });

    const response = await axios.get(INFO_API, {
      params: { id },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: `${BASE_URL}/`,
      },
    });

    const raw = response.data?.mangaPage;

    if (!raw) {
      return res.status(404).json({ error: "Manga not found" });
    }

    const data = {
      id: raw.id,
      title: raw.title,
      englishTitle: raw.englishTitle,
      otherNames: raw.otherNames || [],
      synopsis: raw.synopsis,
      type: raw.type,
      status: raw.status,
      isAdult: raw.isAdult,
      avgRating: raw.avgRating,
      views: raw.views,
      released: raw.released,
      totalChapterCount: raw.totalChapterCount,
      hasMoreChapters: raw.hasMoreChapters,
      commentCount: raw.commentCount,
      reviewCount: raw.reviewCount,
      poster: raw.poster,
      posterCount: raw.posterCount,
      banner: raw.banner,
      authors: (raw.authors || []).map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        type: a.type,
      })),
      scanlators: (raw.scanlators || []).map((s) => ({
        id: s.id,
        name: s.name,
      })),
      genres: (raw.genres || []).map((g) => ({
        id: g.id,
        name: g.name,
        weight: g.weight,
      })),
      tags: (raw.tags || []).map((t) => ({
        id: t.id,
        name: t.name,
        namePath: t.namePath,
        weight: t.weight,
      })),
      externalIds: {
        anilist: raw.anilistId || null,
        mal: raw.malId || null,
        kitsu: raw.kitsuId || null,
        ann: raw.annId || null,
        mangaBaka: raw.mangaBakaId || null,
        mangaUpdates: raw.mangaUpdatesId || null,
        ap: raw.apId || null,
        kenmei: raw.kenmeiUrl || null,
      },
      recommendations: (raw.recommendations || []).map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        isAdult: r.isAdult,
        mbRating: r.mbRating,
        views: r.views,
        image: r.image,
        smallImage: r.smallImage,
        mediumImage: r.mediumImage,
        largeImage: r.largeImage,
      })),
      similarManga: (raw.similarManga || []).map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        isAdult: r.isAdult,
        mbRating: r.mbRating,
        views: r.views,
        image: r.image,
        smallImage: r.smallImage,
        mediumImage: r.mediumImage,
        largeImage: r.largeImage,
      })),
      relations: raw.relations || [],
      chapters: (raw.chapters || []).map((c) => ({
        id: c.id,
        scanlationMangaId: c.scanlationMangaId,
        title: c.title,
        number: c.number,
        index: c.index,
        pageCount: c.pageCount,
        createdAt: c.createdAt,
      })),
    };

    res.json({ data: prefixImageUrls(data) });
  } catch (error) {
    console.error("[AtsuMoe Info] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch manga info",
      message: error.message,
    });
  }
});

module.exports = router;
