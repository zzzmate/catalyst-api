const express = require("express");
const axios = require("axios");
const router = express.Router();

const BASE_URL = "https://mangadot.net";
const API_BASE = "https://mangadot.net/api/manga";

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const language = req.query.language || null;
  const group = req.query.group || null;
  const order = req.query.order === "oldest" ? "oldest" : "newest";
  const search = (req.query.search || "").trim();

  try {
    const url = `${API_BASE}/${id}/chapters/list`;
    console.log("[MangaDotNet Chapters] Fetching:", url);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: `${BASE_URL}/manga/${id}`,
      },
    });

    const raw = Array.isArray(response.data)
      ? response.data
      : response.data.data || response.data.chapters || [];

    const languages = new Set();
    const groups = new Map();

    raw.forEach((ch) => {
      if (ch.language) languages.add(ch.language);
      if (Array.isArray(ch.groups)) {
        ch.groups.forEach((g) => {
          if (g && g.id && !groups.has(String(g.id))) {
            groups.set(String(g.id), g.name);
          }
        });
      }
      if (ch.group_id && ch.group_name && !groups.has(String(ch.group_id))) {
        groups.set(String(ch.group_id), ch.group_name);
      }
    });

    let chapters = raw.map((ch) => ({
      id: String(ch.id),
      number: ch.chapter_number,
      volume: ch.volume_number,
      title: ch.chapter_title || null,
      language: ch.language,
      groups:
        Array.isArray(ch.groups) && ch.groups.length > 0
          ? ch.groups.map((g) => ({ id: String(g.id), name: g.name }))
          : ch.group_id && ch.group_name
            ? [{ id: String(ch.group_id), name: ch.group_name }]
            : [],
      scanlator: ch.scanlator_name || null,
      uploader: {
        id: ch.uploader_id || null,
        username: ch.uploader_username || null,
        status: ch.uploader_upload_status || null,
      },
      pages: ch.page_count || null,
      commentCount: ch.comment_count || 0,
      source: ch.source || null,
      dateAdded: ch.date_added || null,
      url: `${BASE_URL}/chapter/${ch.id}`,
    }));

    if (language) {
      const q = language.toLowerCase();
      chapters = chapters.filter(
        (ch) => ch.language && ch.language.toLowerCase() === q,
      );
    }

    if (group) {
      chapters = chapters.filter((ch) =>
        ch.groups.some(
          (g) =>
            g.id === String(group) ||
            g.name.toLowerCase() === String(group).toLowerCase(),
        ),
      );
    }

    if (search) {
      const q = search.toLowerCase();
      chapters = chapters.filter((ch) => {
        const num = String(ch.number ?? "").toLowerCase();
        const title = (ch.title || "").toLowerCase();
        return num.includes(q) || title.includes(q);
      });
    }

    chapters.sort((a, b) => {
      const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
      const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
      return order === "oldest" ? dateA - dateB : dateB - dateA;
    });

    res.json({
      id,
      filters: {
        languages: Array.from(languages).sort(),
        groups: Array.from(groups.entries())
          .map(([gid, name]) => ({ id: gid, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        orders: ["newest", "oldest"],
      },
      query: {
        language,
        group,
        order,
        search: search || null,
      },
      chapters,
      total: chapters.length,
    });
  } catch (error) {
    console.error("[MangaDotNet Chapters] Error:", error.message);
    res.status(500).json({
      error: "Failed to fetch chapters",
      message: error.message,
    });
  }
});

module.exports = router;
