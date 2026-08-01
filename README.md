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
  Similar to <a href="https://github.com/consumet/api.consumet.org">Consumet</a>, Catalyst aims to be a unified, easy-to-use REST API for entertainment content — built for developers who want to build apps without worrying about scraping.
</p>

---

## 📖 Documentation

Full documentation is available at **[zzzmate.hu/catalyst](https://zzzmate.hu/catalyst)**

The docs cover all available endpoints, query parameters, response formats, caching behavior and more.

---

## ✨ Features

- 🔍 Search and browse manga, manhwa, manhua and more
- 📖 Read chapters with proxied image delivery
- 📦 Built-in caching system to reduce load
- 🎭 Filter by genre, theme, demographic, status, language and more
- 📊 Trending, latest uploads, highest rated, most followed and more
- 🚀 Built with Node.js and Express

---

## 🌐 Providers

<table>
<tr>
<td valign="top">

### 📚 Manga

| Provider | Status |
|----------|--------|
| MangaFire | ✅ Active |
| MangaPill | ✅ Active |
| MangaDotNet | ✅ Active |
| AtsuMoe | ✅ Active |

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

```bash
git clone https://github.com/zzzmate/catalyst-api
cd catalyst-api
npm install
node server.js
