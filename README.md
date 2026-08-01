<div align="right">
  <strong>Catalyst API</strong> · A free, open-source entertainment API
</div>

<br />

<div align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-green" alt="Node" />
  <img src="https://img.shields.io/badge/docs-catalyst.zzzmate.hu-orange" alt="Docs" />
</div>

<br />

<h1 align="center">⚡ Catalyst API</h1>

<p align="center">
  A free, open-source, high-level API that provides accurate information about numerous entertainment mediums such as manga, manhwa, manhua, anime and more — along with links to read and stream content from publicly available online sources.
</p>

<p align="center">
  Similar to <a href="https://github.com/consumet/api.consumet.org">Consumet</a>, Catalyst aims to be a unified, easy-to-use REST API for entertainment content — built for developers who want to build apps without worrying about scraping, tokens or anti-bot protections.
</p>

---

## 📖 Documentation

Full documentation is available at **[catalyst.zzzmate.hu](https://catalyst.zzzmate.hu)**

The docs cover all available endpoints, query parameters, response formats, caching behavior and more.

---

## ✨ Features

- 🔍 Search and browse manga, manhwa, manhua and more across multiple providers
- 📖 Read chapters with proxied image delivery where needed
- 📦 Built-in file-based caching system to reduce load and speed up responses
- 🎭 Filter by genre, theme, demographic, status, language, tags and more
- 📊 Trending, latest uploads, highest rated, most followed, hot updates and more
- 🤖 Automatic Cloudflare bypass via Puppeteer + Stealth for protected sites
- 🔄 Direct JSON API passthrough for sites that expose APIs (MangaDotNet, AtsuMoe)
- 🖼️ Image proxy endpoints with correct referer headers for each provider
- 🚀 Built with Node.js and Express

---

## 🌐 Providers

<table>
<tr>
<td valign="top">

### 📚 Manga

#### 🔴 Puppeteer (Headless Browser)

> Slower first request (~10-15s), bypasses Cloudflare and anti-bot protections. Responses are cached to disk after the first fetch.

| Provider | Endpoints | Status |
|----------|-----------|--------|
| [MangaFire](https://mangafire.to) | Trending, Latest, Browse, Info, Chapters, Read, Proxy | ✅ Active |
| [Mangago](https://www.mangago.me) | Featured, Popular, New Chapters, Top Genres, Browse, Info, Read, Proxy | ✅ Active |

#### 🟢 Axios / Cheerio / JSON API

> Fast responses (~200-500ms), no headless browser needed.

| Provider | Method | Endpoints | Status |
|----------|--------|-----------|--------|
| [MangaPill](https://mangapill.com) | Cheerio | Featured, New Chapters, Trending, Recent, Search, Info, Read, Proxy | ✅ Active |
| [MangaDotNet](https://mangadot.net) | JSON API | Latest Updates, Recently Added, Most Tracked, Top Rated, Browse, Info, Chapters, Read, Proxy | ✅ Active |
| [AtsuMoe](https://atsu.moe) | JSON API | Hot Updates, Recently Updated, Popular, Rising, Hot Arrivals, Browse, Info, Read, Proxy | ✅ Active |
| [WeebCentral](https://weebcentral.com) | Cheerio | Hot Updates, Latest Updates, Recommendations, Browse, Info, Chapters, Read, Proxy | ✅ Active |

</td>
<td valign="top">

### 🎬 Anime

| Provider | Status |
|----------|--------|
| — | ❌ Coming soon... |

</td>
</tr>
</table>

---

## 📦 Self Hosting

### Prerequisites

- **Node.js 18+**
- ~300MB disk space for Chromium (downloaded by Puppeteer on install)

### Installation

```bash
git clone https://github.com/zzzmate/catalyst-api
cd catalyst-api
npm install
