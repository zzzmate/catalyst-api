<div align="right">
  <strong>Catalyst API</strong> · A free, open-source entertainment API
</div>

<br />

<div align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-green" alt="Node" />
  <img src="https://img.shields.io/badge/docs-zzzmate.hu/catalyst-orange" alt="Docs" />
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

Full documentation is available at **[zzzmate.hu/catalyst](https://zzzmate.hu/catalyst)**

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

---

### 🎬 Anime

| Provider | Status |
|----------|--------|
| — | ❌ Coming soon... |

---

## 📦 Self Hosting

### Prerequisites

- **Node.js 18+**
- ~300MB disk space for Chromium (downloaded by Puppeteer on install)

### Installation

    git clone https://github.com/zzzmate/catalyst-api
    cd catalyst-api
    npm install

### Start

    node server.js

The API starts on `http://localhost:5177` by default. Change the port in `server.js`.

### Linux Dependencies

On headless Linux servers, Chromium may need system libraries:

    sudo apt-get install -y \
      ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
      libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 \
      libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 \
      libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
      libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
      libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
      libxtst6 lsb-release wget xdg-utils

---

## 🗂️ Project Structure

    catalyst-api/
    ├── server.js
    ├── config.json
    ├── cache/
    │   ├── mangafire/
    │   ├── mangapill/
    │   ├── mangadotnet/
    │   ├── mangago/
    │   └── ...
    └── routes/
        ├── mangafire/
        ├── mangapill/
        ├── mangadotnet/
        ├── atsumoe/
        ├── weebcentral/
        └── mangago/

---

## ⚙️ Caching

Several endpoints cache responses to disk as JSON files. Cache durations are configurable per-endpoint in `config.json`.

| Situation | Behavior |
|-----------|----------|
| First request | Fetches fresh data (slow for Puppeteer routes) |
| Within cache window | Returns cached data instantly |
| Cache expired | Re-fetches and updates cache |
| Delete `cache/` folder | Forces all endpoints to re-fetch |

Every cached response includes a `"cached": true/false` field so you always know the source.

---

## 🔧 Configuration

All configuration lives in `config.json`. You can edit it while the server is running — it's read on every request.

Key sections:
- **Caching durations** per endpoint
- **Genre/tag ID mappings** (MangaFire, AtsuMoe)
- **Filter value maps** for human-readable names

---

## ⚠️ Disclaimer

Catalyst API is a scraping-based API. All content is sourced from publicly available third-party websites. Catalyst does not host, store or distribute any copyrighted content. The cached files only contain metadata (titles, URLs, chapter lists) — never actual manga pages. Use at your own risk.

---

## 📄 License

MIT © [zzzmate](https://github.com/zzzmate)
