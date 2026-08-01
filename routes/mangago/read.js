const express = require("express");
const cheerio = require("cheerio");
const router = express.Router();
const { BASE_URL, absoluteUrl, fetchPage } = require("./utils");

router.get("/:slug/:path1/:path2", async (req, res) => {
  const { slug, path1, path2 } = req.params;
  handleRead(slug, `${path1}/${path2}`, res);
});

router.get("/:slug/:path1/:path2/:path3", async (req, res) => {
  const { slug, path1, path2, path3 } = req.params;
  handleRead(slug, `${path1}/${path2}/${path3}`, res);
});

router.get("/:slug/:path1/:path2/:path3/:path4", async (req, res) => {
  const { slug, path1, path2, path3, path4 } = req.params;
  handleRead(slug, `${path1}/${path2}/${path3}/${path4}`, res);
});

async function handleRead(slug, chapterPath, res) {
  try {
    const url = `${BASE_URL}/read-manga/${slug}/tr/${chapterPath}`;
    console.log("[Mangago Read] Fetching:", url);
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    let currentPage = 1;
    let totalPages = 0;
    let totalChapters = 0;
    let currentChapter = 0;
    let mangaName = null;
    let chapterName = null;
    let prevUrl = null;
    let nextChapterUrl = null;
    let nextPageUrl = null;
    let pcurl = null;

    const scriptMatch = html.match(
      /var pcurl\s*=\s*"([^"]*)".*?current_chapter\s*=\s*(\d+).*?total_chapters\s*=\s*(\d+).*?current_page\s*=\s*(\d+).*?total_pages\s*=\s*(\d+).*?manga_name\s*=\s*"([^"]*)".*?chapter_name\s*=\s*"([^"]*)".*?prev_url\s*=\s*"([^"]*)".*?next_c_url\s*=\s*"([^"]*)".*?next_url\s*=\s*"([^"]*)"/s,
    );

    if (scriptMatch) {
      pcurl = scriptMatch[1];
      currentChapter = parseInt(scriptMatch[2]);
      totalChapters = parseInt(scriptMatch[3]);
      currentPage = parseInt(scriptMatch[4]);
      totalPages = parseInt(scriptMatch[5]);
      mangaName = scriptMatch[6];
      chapterName = scriptMatch[7];
      prevUrl = scriptMatch[8] ? absoluteUrl(scriptMatch[8]) : null;
      nextChapterUrl = scriptMatch[9] ? absoluteUrl(scriptMatch[9]) : null;
      nextPageUrl = scriptMatch[10] ? absoluteUrl(scriptMatch[10]) : null;
    }

    const pages = [];
    const seenUrls = new Set();

    $("#pic_container img").each((i, el) => {
      const $img = $(el);
      const src = $img.attr("src") || "";
      if (
        !src ||
        src.includes("loading") ||
        src.includes("base64") ||
        seenUrls.has(src)
      )
        return;
      seenUrls.add(src);

      pages.push({
        page: currentPage + i,
        url: src,
      });
    });

    if (pages.length === 0) {
      $('img[src*="mangapicgallery"], img[src*="newpiclink"]').each((i, el) => {
        const src = $(el).attr("src") || "";
        if (!src || seenUrls.has(src)) return;
        seenUrls.add(src);
        pages.push({
          page: currentPage + i,
          url: src,
        });
      });
    }

    const allPageUrls = {};
    if (pcurl && totalPages > 0) {
      for (let i = 1; i <= totalPages; i++) {
        allPageUrls[i] = `${BASE_URL}${pcurl}${i}/`;
      }
    }

    res.json({
      slug,
      chapterPath,
      currentChapter,
      totalChapters,
      currentPage,
      totalPages,
      mangaName,
      chapterName,
      prevUrl,
      nextChapterUrl,
      nextPageUrl,
      pages,
      totalPagesLoaded: pages.length,
    });
  } catch (error) {
    console.error("[Mangago Read] Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch chapter pages", message: error.message });
  }
}

module.exports = router;
