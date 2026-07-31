const express = require("express");
const axios = require("axios");
const router = express.Router();

const BASE_URL = "https://mangadot.net";
const API_URL = "https://mangadot.net/api/uploads";

router.get("/:chapterId", async (req, res) => {
  const { chapterId } = req.params;

  try {
    const url = `${API_URL}/${chapterId}/images`;
    console.log("[MangaDotNet Read] Fetching:", url);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: `${BASE_URL}/chapter/${chapterId}`,
      },
    });

    const raw = response.data || {};
    const proxyBase = `${req.protocol}://${req.get("host")}/mangadotnet/proxy`;

    const chapter = raw.chapter || {};
    const manga = raw.manga || {};
    const images = Array.isArray(raw.images) ? raw.images : [];

    const pages = images.map((img, i) => {
      const originalUrl =
        img.url && img.url.startsWith("http")
          ? img.url
          : `${BASE_URL}${img.url || ""}`;
      return {
        page: i + 1,
        filename: img.filename || null,
        original_url: originalUrl,
        url: `${proxyBase}?url=${encodeURIComponent(originalUrl)}`,
        width: img.w || null,
        height: img.h || null,
      };
    });

    const mangaCover =
      manga.photo && manga.photo.startsWith("http")
        ? manga.photo
        : manga.photo
          ? `${BASE_URL}${manga.photo}`
          : null;

    res.json({
      data: {
        chapter: {
          id: String(chapter.id),
          mangaId: String(chapter.manga_id),
          number: chapter.chapter_number
            ? parseFloat(chapter.chapter_number)
            : null,
          volume: chapter.volume_number,
          title: chapter.chapter_title || null,
          language: chapter.language || null,
          groupId: chapter.group_id ? String(chapter.group_id) : null,
          scanlator: chapter.scanlator_name || null,
          status: chapter.status || null,
          pageCount: chapter.page_count || pages.length,
          dateAdded: chapter.date_added || null,
          type: chapter.type || raw.type || null,
          source: chapter.source || raw.source || null,
          countryOfOrigin: chapter.country_of_origin || null,
          isLongstrip: chapter.is_longstrip,
        },
        manga: {
          id: String(manga.id),
          title: manga.title || null,
          cover: mangaCover
            ? `${proxyBase}?url=${encodeURIComponent(mangaCover)}`
            : null,
          originalCover: mangaCover,
          countryOfOrigin: manga.country_of_origin || null,
          isLongstrip: manga.is_longstrip,
        },
        pages,
        totalPages: pages.length,
        prev: raw.prev_chapter_id
          ? {
              id: String(raw.prev_chapter_id),
              source: raw.prev_source || null,
            }
          : null,
        next: raw.next_chapter_id
          ? {
              id: String(raw.next_chapter_id),
              source: raw.next_source || null,
            }
          : null,
        prevVolumeId: raw.prev_volume_id || null,
        nextVolumeId: raw.next_volume_id || null,
      },
    });
  } catch (error) {
    console.error("[MangaDotNet Read] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch chapter images",
      message: error.message,
    });
  }
});

module.exports = router;
