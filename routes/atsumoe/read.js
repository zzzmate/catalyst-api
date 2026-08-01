const express = require("express");
const axios = require("axios");
const router = express.Router();
const { BASE_URL, prefixImageUrls } = require("./utils");

const READ_API = "https://atsu.moe/api/read/chapter";

router.get("/:mangaId/:chapterId", async (req, res) => {
  const { mangaId, chapterId } = req.params;

  try {
    console.log("[AtsuMoe Read] Fetching:", READ_API, { mangaId, chapterId });

    const response = await axios.get(READ_API, {
      params: { mangaId, chapterId },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: `${BASE_URL}/`,
      },
    });

    const raw = response.data?.readChapter;

    if (!raw) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    const data = {
      id: raw.id,
      title: raw.title,
      scanlationMangaId: raw.scanlationMangaId,
      totalPages: (raw.pages || []).length,
      pages: (raw.pages || []).map((p) => ({
        id: p.id,
        number: p.number,
        image: p.image,
        width: p.width,
        height: p.height,
        aspectRatio: p.aspectRatio,
      })),
    };

    res.json({ data: prefixImageUrls(data) });
  } catch (error) {
    console.error("[AtsuMoe Read] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch chapter",
      message: error.message,
    });
  }
});

module.exports = router;
