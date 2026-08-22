const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const router = express.Router();

const base = 'https://vidhawk.buzz';

const labels = {
  kari: 'Kari',
  zuri: 'Zuri'
};

let browser;

async function initBrowser() {
  if (browser) {
    try {
      const isAlive = typeof browser.isConnected === 'function' ? browser.isConnected() : browser.connected;
      if (isAlive) return browser;
    } catch {
      browser = null;
    }
  }

  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,720'
    ]
  });

  return browser;
}

async function scrape(id, ep, audio, srv, verbose = false) {
  const instance = await initBrowser();
  const page = await instance.newPage();

  const debug = {
    url: null,
    finalUrl: null,
    title: null,
    requests: [],
    responses: [],
    playHits: [],
    console: [],
    pageErrors: [],
    tokenInHtml: false,
    bodyPreview: null,
    note: null
  };

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1280, height: 720 });

    await page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9'
    });

    if (verbose) {
      page.on('console', (msg) => debug.console.push(msg.text()));
      page.on('pageerror', (err) => debug.pageErrors.push(err.message));
    }

    page.on('request', (req) => {
      const u = req.url();
      if (verbose && (u.includes('vidhawk') || u.includes('/api/'))) {
        debug.requests.push({ method: req.method(), url: u });
      }
    });

    page.on('response', (res) => {
      const u = res.url();
      if (verbose && (u.includes('vidhawk') || u.includes('/api/'))) {
        const row = { status: res.status(), url: u };
        debug.responses.push(row);
        if (u.includes('/api/play')) debug.playHits.push(row);
      }
    });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'media'].includes(type)) req.abort();
      else req.continue();
    });

    const url = `${base}/embed/ani/${id}/${ep}/${audio}?server=${srv}`;
    debug.url = url;

    let playData = null;
    let playError = null;

    const playWait = page
      .waitForResponse((res) => res.url().includes('/api/play'), { timeout: 25000 })
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok()) {
          playError = `play status ${res.status()}: ${text.slice(0, 200)}`;
          return null;
        }

        try {
          playData = JSON.parse(text);
          return playData;
        } catch {
          playError = 'play response was not json';
          return null;
        }
      })
      .catch((err) => {
        playError = err.message;
        return null;
      });

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 35000
    });

    if (verbose) {
      debug.finalUrl = page.url();
      debug.title = await page.title();
    }

    await Promise.race([
      playWait,
      new Promise((r) => setTimeout(r, 10000))
    ]);

    if (!playData) {
      const html = await page.content();
      if (verbose) debug.bodyPreview = html.replace(/\s+/g, ' ').slice(0, 600);

      const tokenMatch = html.match(/eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}/);
      if (verbose) debug.tokenInHtml = !!tokenMatch;

      if (tokenMatch) {
        const token = tokenMatch[0];
        const result = await page.evaluate(async (t) => {
          try {
            const r = await fetch(`/api/play?t=${encodeURIComponent(t)}`, {
              credentials: 'include',
              headers: { accept: 'application/json, text/plain, */*' }
            });
            const text = await r.text();
            return { ok: r.ok, status: r.status, text };
          } catch (e) {
            return { ok: false, status: 0, text: e.message };
          }
        }, token);

        if (result.ok) {
          playData = JSON.parse(result.text);
          debug.note = 'used in-page fallback fetch';
        } else {
          playError = `fallback api ${result.status}: ${String(result.text).slice(0, 200)}`;
        }
      } else {
        debug.note = 'no /api/play and no token in html';
      }
    }

    if (!playData) {
      const err = new Error(playError || 'timed out waiting for /api/play');
      err.debug = debug;
      throw err;
    }

    return { data: playData, debug };
  } finally {
    await page.close().catch(() => {});
  }
}

function mapCaps(arr) {
  if (!Array.isArray(arr)) return [];

  return arr.map((i) => ({
    src: i.src || i.u || i.url || '',
    label: i.label || i.l || '',
    lang: i.lang || i.language || '',
    default: Boolean(i.default ?? i.d)
  }));
}

function format(data, meta) {
  if (Array.isArray(data.tracks)) {
    return {
      anilistId: data.anilistId ?? meta.id,
      episode: data.episode ?? meta.ep,
      defaultAudio: data.defaultAudio ?? meta.audio,
      server: data.server ?? meta.srv,
      serverLabel: data.serverLabel || labels[meta.srv] || meta.srv,
      tracks: data.tracks,
      intro: data.intro || null,
      outro: data.outro || null,
      captions: data.captions || { sub: [], dub: [] }
    };
  }

  const sources = data.s || data.sources || {};
  const caps = data.c || data.captions || {};
  const tracks = [];

  if (sources.sub) tracks.push({ id: 'sub', label: 'Sub', src: sources.sub });
  if (sources.dub) tracks.push({ id: 'dub', label: 'Dub', src: sources.dub });

  return {
    anilistId: meta.id,
    episode: meta.ep,
    defaultAudio: meta.audio,
    server: meta.srv,
    serverLabel: labels[meta.srv] || meta.srv,
    tracks,
    intro: data.i ? { start: data.i.s, end: data.i.e } : (data.intro || null),
    outro: data.o ? { start: data.o.s, end: data.o.e } : (data.outro || null),
    captions: {
      sub: mapCaps(caps.sub),
      dub: mapCaps(caps.dub)
    }
  };
}

router.get('/', async (req, res) => {
  const wantDebug = String(req.query.debug || '0') === '1';

  try {
    const id = parseInt(req.query.anilistId, 10);
    const ep = parseInt(req.query.episode, 10);
    const audio = (req.query.audio || 'sub').toString().toLowerCase();
    const srv = (req.query.server || 'kari').toString().toLowerCase();

    if (isNaN(id) || isNaN(ep)) {
      return res.status(400).json({ error: 'missing anilistid or episode' });
    }

    if (!['sub', 'dub'].includes(audio)) {
      return res.status(400).json({ error: 'audio must be sub or dub' });
    }

    if (!['kari', 'zuri'].includes(srv)) {
      return res.status(400).json({ error: 'server must be kari or zuri' });
    }

    console.log(`get ${id}/${ep}/${audio} ${srv}`);

    const { data, debug } = await scrape(id, ep, audio, srv, wantDebug);
    const formatted = format(data, { id, ep, audio, srv });

    console.log(`ok ${id}/${ep}`);

    if (wantDebug) {
      return res.json({ ok: true, data: formatted, raw: data, debug });
    }

    return res.json(formatted);
  } catch (err) {
    console.log(`err: ${err.message.toLowerCase()}`);

    return res.status(500).json({
      ok: false,
      error: err.message.toLowerCase() || 'server error',
      debug: err.debug || null
    });
  }
});

module.exports = router;