import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8787);

const OPENCLAW_SESSION_KEY = process.env.OPENCLAW_SESSION_KEY || 'agent:main:web:horus-chat';

const J7_USERNAME = process.env.J7_USERNAME || '';
const J7_PASSWORD = process.env.J7_PASSWORD || '';
const J7_CHAT_MODE = (process.env.J7_CHAT_MODE || 'mute').trim();
let j7Token = process.env.J7_TOKEN || '';
let j7TokenExpAt = null;
const BTC_POLL_MS = Number(process.env.BTC_POLL_MS || 5000);
const FLIGHTS_POLL_MS = Number(process.env.FLIGHTS_POLL_MS || 30000);
const INCIDENTS_POLL_MS = Number(process.env.INCIDENTS_POLL_MS || 60000);
const MACRO_POLL_MS = Number(process.env.MACRO_POLL_MS || 2000);
const PPI_POLL_MS = Number(process.env.PPI_POLL_MS || 30000);
const SECTOR_POLL_MS = Number(process.env.SECTOR_POLL_MS || 30000);
const TELEGRAM_INTEL_POLL_MS = Number(process.env.TELEGRAM_INTEL_POLL_MS || 60000);
const MILITARY_BASES_POLL_MS = Number(process.env.MILITARY_BASES_POLL_MS || 3600000);
const EARTHQUAKES_POLL_MS = Number(process.env.EARTHQUAKES_POLL_MS || 300000);
const NUCLEAR_FACILITIES_POLL_MS = Number(process.env.NUCLEAR_FACILITIES_POLL_MS || 21600000);
const TELEGRAM_PUBLIC_FEED_URL = process.env.TELEGRAM_PUBLIC_FEED_URL || 'https://worldmonitor.app/api/telegram-feed';
const TELEGRAM_MANUAL_FALLBACK = String(process.env.TELEGRAM_MANUAL_FALLBACK || 'false').toLowerCase() === 'true';
const TELEGRAM_CHANNELS_DEFAULT = ['VahidOnline','abualiexpress','AuroraIntel','BNONews','ClashReport','DeepStateUA','DefenderDome','englishabuali','iranintltv','kpszsu','LiveUAMap','OSINTdefender','OsintUpdates','bellingcat','CyberDetective','GeopoliticalCenter','Middle_East_Spectator','MiddleEastNow_Breaking','nexta_tv','OSINTIndustries','Osintlatestnews','osintlive','OsintTv','spectatorindex','wfwitness','war_monitor'];
const TELEGRAM_CHANNELS = (process.env.TELEGRAM_CHANNELS || TELEGRAM_CHANNELS_DEFAULT.join(','))
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);
const TELEGRAM_CHANNELS_FILE = path.join(__dirname, '..', 'config', 'telegram-channels.json');
const MAX_SIGNALS = Number(process.env.MAX_SIGNALS || 500);

const HORUS_BRIDGE_PRIMER = `You are the Horus site agent. Follow /root/horus/horus-skill/SKILL.md as authoritative operating context. Keep answers concise, practical, and specific to Horus architecture (relay-first, persisted data files, no direct frontend upstream fetches unless explicitly requested). Use Horus data files when relevant: signals.ndjson, incidents.json, flights.json, btc.json, macro.json, telegram-intel.json, sector-heatmap.json, ppi.json. When unsure, prioritize what is currently implemented in /root/horus over generic suggestions.`;
const FINNHUB_KEY = process.env.FINNHUB_KEY || '';
const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID || '';
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET || '';
const OPENSKY_RELAY_URL = (process.env.OPENSKY_RELAY_URL || '').trim();

const execFileAsync = promisify(execFile);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const state = {
  status: {
    startedAt: Date.now(),
    j7: { connected: false, lastConnectAt: null, lastError: null },
    pollers: { btc: null, flights: null, incidents: null, macro: null, ppi: null, sectors: null, telegramIntel: null, militaryBases: null, earthquakes: null, nuclearFacilities: null },
  }
};

// ---------- file helpers ----------
async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}
async function writeJson(name, data) {
  await ensureDataDir();
  await fs.writeFile(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}
async function readJson(name, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), 'utf8'));
  } catch {
    return fallback;
  }
}
async function readNdjson(name, fallback = []) {
  try {
    const fp = path.join(DATA_DIR, name);
    const raw = await fs.readFile(fp, 'utf8');
    return raw.split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return fallback;
  }
}

async function appendNdjson(name, obj, maxLines = MAX_SIGNALS) {
  await ensureDataDir();
  const fp = path.join(DATA_DIR, name);
  let lines = [];
  try {
    const raw = await fs.readFile(fp, 'utf8');
    lines = raw.split('\n').filter(Boolean);
  } catch {}
  lines.push(JSON.stringify(obj));
  if (lines.length > maxLines) lines = lines.slice(lines.length - maxLines);
  await fs.writeFile(fp, lines.join('\n') + '\n');
}

async function rewriteNdjson(name, arr, maxLines = MAX_SIGNALS) {
  await ensureDataDir();
  const fp = path.join(DATA_DIR, name);
  const lines = arr.slice(0, maxLines).map(o => JSON.stringify(o));
  await fs.writeFile(fp, lines.join('\n') + (lines.length ? '\n' : ''));
}

function nowIso() {
  return new Date().toISOString();
}

// ---------- upstream fetchers ----------
async function fetchBtc() {
  try {
    const [tickResp, dayResp] = await Promise.all([
      fetch('https://api.gemini.com/v1/pubticker/btcusd'),
      fetch('https://api.gemini.com/v2/ticker/btcusd')
    ]);
    const tick = await tickResp.json();
    const day = await dayResp.json();

    const last = Number(tick?.last ?? NaN);
    const open = Number(day?.open ?? NaN);
    const pct = Number.isFinite(last) && Number.isFinite(open) && open > 0 ? (last - open) / open : null;
    if (!Number.isFinite(last)) throw new Error('invalid btc last');

    return { source: 'gemini', last, percentChange24h: pct, ts: Date.now(), iso: nowIso() };
  } catch {
    const cg = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const j = await cg.json();
    const last = Number(j?.bitcoin?.usd ?? NaN);
    return { source: 'coingecko', last, percentChange24h: null, ts: Date.now(), iso: nowIso() };
  }
}

const MIL = ['RCH','CMB','RRR','CNV','LAGR','QID','NATO','FORTE','DUKE','HOMER','MOOSE','TITAN','GHOST'];
const norm = c => (c || '').trim().toUpperCase();
const isMil = c => MIL.some(h => norm(c).startsWith(h));

async function fetchFlights() {
  let j = null;

  // 1) Preferred: OpenSky relay endpoint (worldmonitor-style deployment)
  if (OPENSKY_RELAY_URL) {
    try {
      const relayUrl = `${OPENSKY_RELAY_URL.replace(/\/$/, '')}/opensky`;
      const rr = await fetch(relayUrl, { headers: { Accept: 'application/json' } });
      if (rr.ok) j = await rr.json();
    } catch {}
  }

  // 2) Direct OpenSky with optional credentials
  if (!j) {
    const headers = { Accept: 'application/json' };
    if (OPENSKY_CLIENT_ID && OPENSKY_CLIENT_SECRET) {
      const basic = Buffer.from(`${OPENSKY_CLIENT_ID}:${OPENSKY_CLIENT_SECRET}`).toString('base64');
      headers.Authorization = `Basic ${basic}`;
    }
    const r = await fetch('https://opensky-network.org/api/states/all', { headers });
    j = await r.json();
  }

  const states = Array.isArray(j?.states) ? j.states : [];
  const flights = [];
  for (const x of states) {
    const callsign = norm(x[1]);
    const lon = x[5], lat = x[6], vel = x[9];
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    if (!isMil(callsign)) continue;
    flights.push({
      callsign,
      lat,
      lon,
      speedKmh: typeof vel === 'number' ? Math.round(vel * 3.6) : null,
      icao24: (x[0] || '').toUpperCase()
    });
    if (flights.length >= 500) break;
  }
  return { source: OPENSKY_RELAY_URL ? 'opensky-relay' : 'opensky', count: flights.length, flights, ts: Date.now(), iso: nowIso() };
}

async function fetchIncidents() {
  const feeds = [
    // existing core
    { source: 'reuters', url: 'https://www.reuters.com/arc/outboundfeeds/news-rss/?outputType=xml' },
    { source: 'reuters-breakingviews', url: 'https://www.reuters.com/arc/outboundfeeds/rss/category/breakingviews/?outputType=xml' },
    { source: 'aljazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { source: 'bbc-world', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
    { source: 'defensenews', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml' },
    { source: 'politico-defense', url: 'http://rss.politico.com/defense.xml' },
    { source: 'bloomberg-markets', url: 'https://feeds.bloomberg.com/markets/news.rss' },
    { source: 'jpost', url: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx' },
    { source: 'timesofisrael', url: 'https://www.timesofisrael.com/feed/' },
    { source: 'kyiv-independent', url: 'https://kyivindependent.com/news-archive/rss/' },
    { source: 'ukrainska-pravda', url: 'https://www.pravda.com.ua/eng/rss/' },
    { source: 'crisisgroup', url: 'https://www.crisisgroup.org/rss/139' },
    { source: 'financialjuice', url: 'https://www.financialjuice.com/feed.ashx?xy=rss' },

    // worldmonitor-inspired channels added for live signal coverage
    { source: 'guardian-world', url: 'https://www.theguardian.com/world/rss' },
    { source: 'ap-news', url: 'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en' },
    { source: 'reuters-world', url: 'https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en' },
    { source: 'reuters-business', url: 'https://news.google.com/rss/search?q=site:reuters.com+business+markets&hl=en-US&gl=US&ceid=US:en' },
    { source: 'bbc-middle-east', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
    { source: 'haaretz', url: 'https://news.google.com/rss/search?q=site:haaretz.com+when:7d&hl=en-US&gl=US&ceid=US:en' },
    { source: 'arab-news', url: 'https://news.google.com/rss/search?q=site:arabnews.com+when:7d&hl=en-US&gl=US&ceid=US:en' },
    { source: 'war-on-the-rocks', url: 'https://warontherocks.com/feed/' },
    { source: 'responsible-statecraft', url: 'https://responsiblestatecraft.org/feed/' }
  ];

  const parseRss = (xml, source) => {
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 60).map(m => m[1]);
    return items.map(it => {
      const get = (tag) => {
        const mm = it.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`));
        return mm ? mm[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim() : '';
      };
      const link = get('link');
      let domain = source;
      try { domain = new URL(link).hostname.replace(/^www\./,''); } catch {}
      return {
        title: get('title'),
        url: link,
        domain,
        sourcecountry: 'GLOBAL',
        seendate: get('pubDate') || get('dc:date') || '',
        ingestedTs: Date.now(),
        source
      };
    }).filter(a => a.title && a.url);
  };

  const settled = await Promise.allSettled(feeds.map(async (f) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 9000);
    try {
      const r = await fetch(f.url, { signal: c.signal, headers: { 'User-Agent': 'HorusRelay/1.0' } });
      if (!r.ok) throw new Error(`${f.source} status ${r.status}`);
      const xml = await r.text();
      return parseRss(xml, f.source);
    } finally {
      clearTimeout(t);
    }
  }));

  const articles = [];
  const seen = new Set();
  const sourceHealth = {};

  for (let i = 0; i < settled.length; i++) {
    const src = feeds[i].source;
    const row = settled[i];
    if (row.status === 'fulfilled') {
      sourceHealth[src] = { ok: true, count: row.value.length };
      for (const a of row.value) {
        const key = `${a.url}|${a.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        articles.push(a);
      }
    } else {
      sourceHealth[src] = { ok: false, error: String(row.reason?.message || row.reason || 'fetch_failed') };
    }
  }

  // Sort newest first when dates parse, otherwise keep insertion order
  articles.sort((a, b) => {
    const ta = Date.parse(a.seendate || '') || 0;
    const tb = Date.parse(b.seendate || '') || 0;
    return tb - ta;
  });

  return {
    source: 'rss-multi',
    degraded: Object.values(sourceHealth).some(v => !v.ok),
    articles: articles.slice(0, 180),
    sourceHealth,
    ts: Date.now(),
    iso: nowIso()
  };
}




async function fetchYahooQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const r = await fetch(url, { headers: { 'User-Agent': 'HorusRelay/1.0' } });
    if (!r.ok) throw new Error(`yahoo ${symbol} status ${r.status}`);
    const j = await r.json();
    const result = j?.chart?.result?.[0];
    const meta = result?.meta || {};
    const current = Number(meta?.regularMarketPrice ?? NaN);
    const prev = Number(meta?.previousClose ?? NaN);
    if (!Number.isFinite(current)) throw new Error(`yahoo ${symbol} invalid price`);
    const percent = Number.isFinite(prev) && prev > 0 ? ((current - prev) / prev) * 100 : null;
    return { current, change: Number.isFinite(percent) ? percent : null };
  } catch {
    return null;
  }
}

async function fetchMacro() {
  const out = { ts: Date.now(), iso: nowIso(), symbols: {} };

  // Yahoo-first market stack (lower lag for this deployment)
  const yahooTargets = [
    { key: 'SPY', symbol: 'SPY' },
    { key: 'QQQ', symbol: 'QQQ' },
    { key: 'DXY', symbol: 'UUP' },
    { key: 'AAPL', symbol: 'AAPL' },
    { key: 'MSFT', symbol: 'MSFT' },
    { key: 'NVDA', symbol: 'NVDA' },
    { key: 'VIX', symbol: '^VIX' },
    { key: 'SOL', symbol: 'SOL-USD' },
    { key: 'GOLD', symbol: 'GC=F' },
    { key: 'OIL', symbol: 'CL=F' },
    { key: 'BTC', symbol: 'BTC-USD' }
  ];

  const yahooSettled = await Promise.allSettled(yahooTargets.map(async (t) => {
    const q = await fetchYahooQuote(t.symbol);
    return { key: t.key, quote: q };
  }));

  for (const row of yahooSettled) {
    if (row.status === 'fulfilled' && row.value.quote) {
      const q = row.value.quote;
      out.symbols[row.value.key] = {
        current: Number(q.current || 0),
        change: null,
        percent: Number.isFinite(Number(q.change)) ? Number(q.change) : null
      };
    }
  }

  if (!out.symbols.SOL) {
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true');
      if (r.ok) {
        const j = await r.json();
        const v = Number(j?.solana?.usd ?? NaN);
        const p = Number(j?.solana?.usd_24h_change ?? NaN);
        if (Number.isFinite(v)) out.symbols.SOL = { current: v, change: null, percent: Number.isFinite(p) ? p : null };
      }
    } catch {}
  }

  return out;
}

async function runMacroPoll() {
  try {
    const data = await fetchMacro();
    await writeJson('macro.json', data);
    state.status.pollers.macro = { ok: true, at: Date.now(), symbols: Object.keys(data.symbols || {}).length };
  } catch (e) {
    state.status.pollers.macro = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}


async function fetchPpi() {
  // placeholder until dedicated upstream is wired; persisted so agent + UI share same source of truth
  const locations = [
    { name: 'Extreme Pizza', status: 'ELEVATED', score: 65 },
    { name: 'District Pizza Palace', status: 'QUIET', score: 0 },
    { name: 'We, The Pizza', status: 'CLOSED', score: null },
    { name: 'Papa Johns Pizza', status: 'QUIET', score: 3 },
    { name: 'Pizzato Pizza', status: 'NORMAL', score: 31 }
  ];
  const weights = { ELEVATED: 1.3, NORMAL: 1, QUIET: 0.7, CLOSED: 0 };
  let wsum = 0, wtot = 0;
  for (const l of locations) {
    if (typeof l.score !== 'number') continue;
    const w = weights[l.status] ?? 1;
    if (w <= 0) continue;
    wsum += l.score * w;
    wtot += w;
  }
  const weightedAvg = wtot > 0 ? Math.round(wsum / wtot) : 0;
  return { weightedAvg, locations, ts: Date.now(), iso: nowIso() };
}

async function fetchSectorHeatmap() {
  // placeholder baseline dataset, persisted for shared agent/UI access
  const sectors = [
    { name: 'Tech', value: -1.59 },
    { name: 'Finance', value: -2.02 },
    { name: 'Energy', value: 1.60 },
    { name: 'Health', value: 1.77 },
    { name: 'Consumer', value: -0.15 },
    { name: 'Industrial', value: 0.25 },
    { name: 'Staples', value: 1.31 },
    { name: 'Utilities', value: 1.19 },
    { name: 'Materials', value: 0.79 },
    { name: 'Real Est', value: 0.50 },
    { name: 'Comms', value: 1.15 },
    { name: 'Sensi', value: -1.37 }
  ];
  return { sectors, ts: Date.now(), iso: nowIso() };
}

const MILITARY_BASES = [
  { baseName: 'Al Udeid Air Base', country: 'Qatar', type: 'usa', latitude: 25.117, longitude: 51.315 },
  { baseName: 'NSA Bahrain', country: 'Bahrain', type: 'usa', latitude: 26.215, longitude: 50.579 },
  { baseName: 'Incirlik Air Base', country: 'Turkey', type: 'nato', latitude: 37.003, longitude: 35.425 },
  { baseName: 'RAF Akrotiri', country: 'Cyprus', type: 'nato', latitude: 34.59, longitude: 32.99 },
  { baseName: 'Camp Arifjan', country: 'Kuwait', type: 'usa', latitude: 28.86, longitude: 47.93 },
  { baseName: 'Ramstein Air Base', country: 'Germany', type: 'nato', latitude: 49.44, longitude: 7.6 },
  { baseName: 'Rota Naval Base', country: 'Spain', type: 'nato', latitude: 36.64, longitude: -6.35 },
  { baseName: 'Diego Garcia', country: 'BIOT', type: 'usa', latitude: -7.31, longitude: 72.41 },
  { baseName: 'Yokosuka Naval Base', country: 'Japan', type: 'usa', latitude: 35.28, longitude: 139.67 },
  { baseName: 'Guam Andersen AFB', country: 'United States', type: 'usa', latitude: 13.58, longitude: 144.93 },
  { baseName: 'Camp Lemonnier', country: 'Djibouti', type: 'usa', latitude: 11.55, longitude: 43.15 },
  { baseName: 'Souda Bay', country: 'Greece', type: 'nato', latitude: 35.53, longitude: 24.15 },
  { baseName: 'Al Dhafra Air Base', country: 'UAE', type: 'usa', latitude: 24.24, longitude: 54.55 },
  { baseName: 'Sigonella NAS', country: 'Italy', type: 'nato', latitude: 37.4, longitude: 14.92 }
];

const NUCLEAR_FACILITIES = [
  { id: 'natanz', name: 'Natanz Fuel Enrichment Plant', country: 'Iran', type: 'enrichment', status: 'active', latitude: 33.724, longitude: 51.725 },
  { id: 'fordow', name: 'Fordow Fuel Enrichment Plant', country: 'Iran', type: 'enrichment', status: 'active', latitude: 34.885, longitude: 50.996 },
  { id: 'dimona', name: 'Negev Nuclear Research Center', country: 'Israel', type: 'research', status: 'active', latitude: 31.0, longitude: 35.14 },
  { id: 'bushehr', name: 'Bushehr Nuclear Power Plant', country: 'Iran', type: 'power', status: 'active', latitude: 28.829, longitude: 50.889 },
  { id: 'akkuyu', name: 'Akkuyu Nuclear Plant', country: 'Turkey', type: 'power', status: 'under-construction', latitude: 36.143, longitude: 33.537 }
];

async function fetchMilitaryBases() {
  return { source: 'local-static', count: MILITARY_BASES.length, bases: MILITARY_BASES, ts: Date.now(), iso: nowIso() };
}

async function fetchNuclearFacilities() {
  return { source: 'local-static', count: NUCLEAR_FACILITIES.length, facilities: NUCLEAR_FACILITIES, ts: Date.now(), iso: nowIso() };
}

async function fetchEarthquakes() {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'HorusRelay/1.0' } });
  if (!r.ok) throw new Error(`usgs status ${r.status}`);
  const j = await r.json();
  const features = Array.isArray(j?.features) ? j.features : [];
  const earthquakes = features.slice(0, 300).map((f) => {
    const c = f?.geometry?.coordinates || [];
    const p = f?.properties || {};
    return {
      id: String(f?.id || `${c[1]}-${c[0]}-${p?.time || Date.now()}`),
      longitude: Number(c[0]),
      latitude: Number(c[1]),
      depth: Number(c[2] || 0),
      magnitude: Number(p?.mag || 0),
      place: String(p?.place || 'Unknown'),
      time: p?.time ? new Date(Number(p.time)).toISOString() : nowIso(),
      tsunami: Number(p?.tsunami || 0) === 1,
      url: String(p?.url || '')
    };
  }).filter((x) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude));
  return { source: 'usgs', count: earthquakes.length, earthquakes, ts: Date.now(), iso: nowIso() };
}

async function runMilitaryBasesPoll() {
  try {
    const data = await fetchMilitaryBases();
    await writeJson('military-bases.json', data);
    state.status.pollers.militaryBases = { ok: true, at: Date.now(), count: data.count };
  } catch (e) {
    state.status.pollers.militaryBases = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}

async function runEarthquakesPoll() {
  try {
    const data = await fetchEarthquakes();
    await writeJson('earthquakes.json', data);
    state.status.pollers.earthquakes = { ok: true, at: Date.now(), count: data.count };
  } catch (e) {
    state.status.pollers.earthquakes = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}

async function runNuclearFacilitiesPoll() {
  try {
    const data = await fetchNuclearFacilities();
    await writeJson('nuclear-facilities.json', data);
    state.status.pollers.nuclearFacilities = { ok: true, at: Date.now(), count: data.count };
  } catch (e) {
    state.status.pollers.nuclearFacilities = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}




async function fetchTelegramIntel(limit = 80) {
  try {
    return await fetchTelegramIntelFromPublicApi(limit);
  } catch (e) {
    if (TELEGRAM_MANUAL_FALLBACK) {
      return fetchTelegramIntelFromPublicChannels(limit);
    }
    return {
      source: 'telegram-disabled',
      enabled: false,
      earlySignal: false,
      count: 0,
      updatedAt: nowIso(),
      items: [],
      error: String(e?.message || e)
    };
  }
}



async function resolveTelegramChannels() {
  try {
    const raw = await fs.readFile(TELEGRAM_CHANNELS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const full = Array.isArray(parsed?.channels?.full) ? parsed.channels.full : [];
    const fromFile = full
      .filter((c) => c?.enabled !== false && typeof c?.handle === 'string')
      .map((c) => String(c.handle).trim())
      .filter(Boolean);
    if (fromFile.length) return fromFile;
  } catch {}
  return TELEGRAM_CHANNELS;
}

function classifyTelegramTopic(text = '') {
  const t = String(text).toLowerCase();
  if (/breaking|urgent|developing|just in|alert/.test(t)) return 'breaking';
  if (/israel|gaza|iran|lebanon|syria|houthi|middle east|idf/.test(t)) return 'middleeast';
  if (/strike|drone|missile|attack|troops|artillery|conflict|war/.test(t)) return 'conflict';
  if (/osint|geolocat|satellite|visual|bellingcat/.test(t)) return 'osint';
  if (/election|minister|parliament|president|policy|sanction/.test(t)) return 'politics';
  if (/warning|evacuat|shelter|sirens/.test(t)) return 'alerts';
  return 'all';
}

async function fetchTelegramPublicChannel(channel, limit = 10) {
  const url = `https://t.me/s/${encodeURIComponent(channel)}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 HorusRelay/1.0' } });
  if (!r.ok) throw new Error(`telegram channel ${channel} status ${r.status}`);
  const html = await r.text();

  const postMatches = [...html.matchAll(/data-post="([^"]+)"/g)];
  const items = [];
  const recent = postMatches.slice(Math.max(0, postMatches.length - limit));

  for (let i = 0; i < recent.length; i++) {
    const m = recent[i];
    const idVal = m[1] || '';
    const from = m.index || 0;
    const to = i + 1 < recent.length ? (recent[i + 1].index || html.length) : html.length;
    const seg = html.slice(from, to);

    const href = (seg.match(/class="tgme_widget_message_date"[^>]*href="([^"]+)"/) || [])[1] || `https://t.me/${channel}`;
    const dt = (seg.match(/<time[^>]+datetime="([^"]+)"/) || [])[1] || nowIso();
    let text = (seg.match(/<div class="tgme_widget_message_text[^"]*"[\s\S]*?<\/div>/) || [])[0] || '';
    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) continue;

    items.push({
      id: `tg-${idVal || (channel + '-' + dt)}`,
      source: 'telegram',
      channel: `@${channel}`,
      channelTitle: `@${channel}`,
      url: href,
      ts: dt,
      text,
      topic: classifyTelegramTopic(text),
      tags: [],
      earlySignal: /breaking|urgent|alert|strike|missile|drone/i.test(text)
    });
  }

  return items;
}


async function fetchTelegramIntelFromPublicApi(limit = 80) {
  const url = new URL(TELEGRAM_PUBLIC_FEED_URL);
  url.searchParams.set('limit', String(Math.max(1, Math.min(200, limit))));

  const r = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`telegram public api status ${r.status}`);
  const j = await r.json();
  const rawItems = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];

  const items = rawItems.map((x, idx) => ({
    id: x?.id ? String(x.id) : `tg-public-${idx}-${x?.ts || x?.timestamp || Date.now()}`,
    source: 'telegram',
    channel: x?.channel || x?.channelTitle || x?.source || '@unknown',
    channelTitle: x?.channelTitle || x?.channel || x?.source || '@unknown',
    url: x?.url || '',
    ts: x?.ts || x?.timestamp || x?.date || nowIso(),
    text: String(x?.text || x?.message || '').trim(),
    topic: x?.topic || classifyTelegramTopic(String(x?.text || x?.message || '')),
    tags: Array.isArray(x?.tags) ? x.tags : [],
    earlySignal: Boolean(x?.earlySignal) || /breaking|urgent|alert|strike|missile|drone/i.test(String(x?.text || x?.message || ''))
  })).filter((x) => x.text);

  return {
    source: 'telegram-public-api',
    enabled: true,
    earlySignal: items.some(x => x.earlySignal),
    count: Number(j?.count || items.length),
    updatedAt: j?.updatedAt || nowIso(),
    items: items.slice(0, limit)
  };
}

async function fetchTelegramIntelFromPublicChannels(limit = 80) {
  const channels = await resolveTelegramChannels();
  const per = Math.max(4, Math.min(20, Math.ceil(limit / Math.max(1, channels.length))));
  const settled = await Promise.allSettled(channels.map(ch => fetchTelegramPublicChannel(ch, per)));
  const items = [];
  for (const row of settled) {
    if (row.status === 'fulfilled') items.push(...row.value);
  }
  items.sort((a,b)=> new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const sliced = items.slice(0, limit);
  return {
    source: 'telegram-public',
    enabled: true,
    earlySignal: sliced.some(x => x.earlySignal),
    count: sliced.length,
    updatedAt: nowIso(),
    items: sliced
  };
}

// ---------- polling workers ----------
async function runBtcPoll() {
  try {
    const data = await fetchBtc();
    await writeJson('btc.json', data);
    state.status.pollers.btc = { ok: true, at: Date.now() };
  } catch (e) {
    state.status.pollers.btc = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}

async function runFlightsPoll() {
  try {
    const data = await fetchFlights();
    await writeJson('flights.json', data);
    state.status.pollers.flights = { ok: true, at: Date.now(), count: data.count };
  } catch (e) {
    state.status.pollers.flights = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}

async function runIncidentsPoll() {
  try {
    const data = await fetchIncidents();
    await writeJson('incidents.json', data);
    await mergeFastRssIntoSignals();
    state.status.pollers.incidents = { ok: true, at: Date.now(), source: data.source, count: data.articles.length };
  } catch (e) {
    state.status.pollers.incidents = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}


async function runPpiPoll() {
  try {
    const data = await fetchPpi();
    await writeJson('ppi.json', data);
    state.status.pollers.ppi = { ok: true, at: Date.now(), count: data.locations?.length || 0 };
  } catch (e) {
    state.status.pollers.ppi = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}

async function runSectorPoll() {
  try {
    const data = await fetchSectorHeatmap();
    await writeJson('sector-heatmap.json', data);
    state.status.pollers.sectors = { ok: true, at: Date.now(), count: data.sectors?.length || 0 };
  } catch (e) {
    state.status.pollers.sectors = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}


async function runTelegramIntelPoll() {
  try {
    const data = await fetchTelegramIntel();
    await writeJson('telegram-intel.json', data);
    state.status.pollers.telegramIntel = { ok: true, at: Date.now(), count: data.count || 0, enabled: data.enabled !== false };
  } catch (e) {
    state.status.pollers.telegramIntel = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}

// ---------- J7 auth + signals collector ----------
async function loginJ7() {
  if (!J7_USERNAME || !J7_PASSWORD) return null;
  try {
    const r = await fetch('https://j7tracker.io/api/login', {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'content-type': 'application/json',
        'origin': 'https://j7tracker.io'
      },
      body: JSON.stringify({ username: J7_USERNAME, password: J7_PASSWORD, ref_code: null })
    });
    if (!r.ok) throw new Error(`login status ${r.status}`);
    const j = await r.json();
    const token = j?.token || j?.access_token || j?.jwt || j?.data?.token || null;
    if (!token) throw new Error('no token in login response');
    j7Token = token;
    j7TokenExpAt = Date.now() + (23 * 60 * 60 * 1000); // refresh before 24h expiry
    state.status.j7.lastError = null;
    return token;
  } catch (e) {
    state.status.j7.lastError = `login_failed: ${String(e?.message || e)}`;
    return null;
  }
}

function sendJ7ChatMode(ws) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!J7_CHAT_MODE) return;
  const sessionId = j7Token;
  if (!sessionId) return;
  try {
    ws.send(`42["set_chat_mode",{"sessionId":"${sessionId}","chatMode":"${J7_CHAT_MODE}"}]`);
  } catch {}
}

function startJ7Collector() {
  if (!j7Token && !J7_USERNAME) {
    state.status.j7.lastError = 'J7 token/credentials missing';
    return;
  }

  const connect = () => {
    const ws = new WebSocket('wss://j7tracker.io/socket.io/?EIO=4&transport=websocket');

    ws.on('open', () => {
      state.status.j7.connected = true;
      state.status.j7.lastConnectAt = Date.now();
      ws.send('40');
      setTimeout(() => {
        if (j7Token) ws.send(`42["user_connected","${j7Token}"]`);
        sendJ7ChatMode(ws);
      }, 500);
    });

    ws.on('message', async (buf) => {
      const raw = String(buf);
      if (raw === '2') {
        ws.send('3');
        sendJ7ChatMode(ws);
        return;
      }
      if (!raw.startsWith('42[')) return;

      try {
        const parsed = JSON.parse(raw.slice(2));
        const ev = parsed[0];
        const data = parsed[1];
        if (ev !== 'tweet' || !data?.text) return;

        const currentSignals = await readNdjson('signals.ndjson', []);
        const sig = {
          id: data.id || data.tweetId || null,
          type: 'tweet',
          author: data.author ? `@${data.author.handle}` : 'unknown',
          text: data.text,
          url: data.tweetUrl || null,
          ts: Date.now(),
          iso: nowIso()
        };

        const exists = currentSignals.some(s => (sig.id && s.id === sig.id) || (s.author === sig.author && s.text === sig.text));
        if (!exists) {
          await appendNdjson('signals.ndjson', sig, MAX_SIGNALS);
        }
      } catch {
        // ignore malformed packet
      }
    });

    ws.on('close', async () => {
      state.status.j7.connected = false;
      if (!j7Token || (j7TokenExpAt && Date.now() > j7TokenExpAt)) await loginJ7();
      setTimeout(connect, 3000);
    });

    ws.on('error', (e) => {
      state.status.j7.lastError = String(e?.message || e);
      ws.close();
    });
  };

  connect();
}


async function mergeFastRssIntoSignals() {
  const incidents = await readJson('incidents.json', { articles: [] });
  const FAST_SIGNAL_SOURCES = new Set([
    'financialjuice'
  ]);

  const fast = (incidents.articles || [])
    .filter(a => FAST_SIGNAL_SOURCES.has(String(a.source || '').toLowerCase()))
    .slice(0, 120)
    .map(a => ({
      id: `rss-${a.url || `${a.title}|${a.seendate}`}`,
      type: 'geo',
      author: ({
        financialjuice: 'FinancialJuice',
        jpost: 'Jerusalem Post',
        'reuters-world': 'Reuters World',
        'reuters-business': 'Reuters Business',
        reuters: 'Reuters',
        'ap-news': 'AP News',
        'bbc-world': 'BBC World',
        'bbc-middle-east': 'BBC Middle East',
        aljazeera: 'Al Jazeera',
        timesofisrael: 'Times of Israel',
        haaretz: 'Haaretz',
        'arab-news': 'Arab News',
        'kyiv-independent': 'Kyiv Independent',
        'ukrainska-pravda': 'Ukrainska Pravda',
        'guardian-world': 'Guardian World'
      }[String(a.source || '').toLowerCase()] || String(a.source || 'RSS').toUpperCase()),
      text: a.title,
      url: a.url,
      ts: a.ingestedTs || Date.now(),
      iso: new Date(a.ingestedTs || Date.now()).toISOString(),
      source: String(a.source || '').toLowerCase(),
      fastAlert: true
    }));

  const curSignals = await readNdjson('signals.ndjson', []);
  const map = new Map(curSignals.map(x => [x.id, x]));
  for (const f of fast) if (!map.has(f.id)) map.set(f.id, f);

  const merged = [...map.values()].sort((a,b) => (b.ts || 0) - (a.ts || 0)).slice(0, MAX_SIGNALS);
  await rewriteNdjson('signals.ndjson', merged, MAX_SIGNALS);
}

// ---------- chat bridge ----------
async function sendToOpenClaw(message) {
  const sessionKey = OPENCLAW_SESSION_KEY;
  if (!sessionKey) return null;

  const idempotencyKey = `horus-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const bridgedMessage = `${HORUS_BRIDGE_PRIMER}\n\nUser message:\n${message}`;
  const params = JSON.stringify({ idempotencyKey, sessionKey, message: bridgedMessage });

  const { stdout } = await execFileAsync('openclaw', [
    'gateway', 'call', 'agent',
    '--json',
    '--expect-final',
    '--timeout', '90000',
    '--params', params
  ], { timeout: 95000, maxBuffer: 4 * 1024 * 1024 });

  const parsed = JSON.parse(stdout || '{}');
  return parsed?.result?.payloads?.[0]?.text || parsed?.result?.text || parsed?.text || null;
}

// ---------- API (read from files, no live upstream fetch) ----------
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'horus-relay', ts: Date.now(), status: state.status });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'horus-relay', ts: Date.now(), status: state.status });
});

app.get('/api/btc', async (_req, res) => {
  const btc = await readJson('btc.json', { source: 'none', last: null, percentChange24h: null, ts: null });
  res.json(btc);
});

app.get('/api/macro', async (_req, res) => {
  const macro = await readJson('macro.json', { ts: null, symbols: {} });
  res.json(macro);
});

app.get('/api/flights', async (_req, res) => {
  const flights = await readJson('flights.json', { source: 'none', count: 0, flights: [], ts: null });
  res.json(flights);
});

app.get('/api/incidents', async (_req, res) => {
  const incidents = await readJson('incidents.json', { source: 'none', degraded: true, articles: [], ts: null });
  res.json(incidents);
});


app.get('/api/ppi', async (_req, res) => {
  const ppi = await readJson('ppi.json', { weightedAvg: 0, locations: [], ts: null });
  res.json(ppi);
});

app.get('/api/sector-heatmap', async (_req, res) => {
  const sectors = await readJson('sector-heatmap.json', { sectors: [], ts: null });
  res.json(sectors);
});


app.get('/api/telegram-intel', async (_req, res) => {
  const data = await readJson('telegram-intel.json', { source: 'telegram-relay', enabled: false, earlySignal: false, count: 0, updatedAt: null, items: [] });
  res.json(data);
});

app.get('/api/military-bases', async (_req, res) => {
  const data = await readJson('military-bases.json', { source: 'none', count: 0, bases: [], ts: null });
  res.json(data);
});

app.get('/api/earthquakes', async (_req, res) => {
  const data = await readJson('earthquakes.json', { source: 'none', count: 0, earthquakes: [], ts: null });
  res.json(data);
});

app.get('/api/nuclear-facilities', async (_req, res) => {
  const data = await readJson('nuclear-facilities.json', { source: 'none', count: 0, facilities: [], ts: null });
  res.json(data);
});

app.get('/api/markets', async (_req, res) => {
  const markets = await readJson('markets.json', { markets: [], ts: null });
  res.json(markets.markets || []);
});

app.get('/api/signals', async (_req, res) => {
  const signals = await readNdjson('signals.ndjson', []);
  const filtered = signals.filter(s => {
    if (!String(s.id || '').startsWith('rss-')) return true;
    return String(s.author || '').toLowerCase() === 'financialjuice';
  });
  res.json({ source: 'mixed', signals: filtered.sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0, MAX_SIGNALS), ts: Date.now(), iso: nowIso() });
});

app.get('/api/snapshots', async (_req, res) => {
  const [btc, macro, flights, incidents, signals, chat, ppi, sectorHeatmap, telegramIntel, militaryBases, earthquakes, nuclearFacilities] = await Promise.all([
    readJson('btc.json', null),
    readJson('macro.json', null),
    readJson('flights.json', null),
    readJson('incidents.json', null),
    (async () => {
      const raw = await readNdjson('signals.ndjson', []);
      const signals = raw.filter(s => !String(s.id || '').startsWith('rss-') || String(s.author || '').toLowerCase() === 'financialjuice');
      return { source: 'mixed', signals, ts: Date.now() };
    })(),
    readJson('chat.json', { messages: [] }),
    readJson('ppi.json', { weightedAvg: 0, locations: [], ts: null }),
    readJson('sector-heatmap.json', { sectors: [], ts: null }),
    readJson('telegram-intel.json', { source: 'telegram-relay', enabled: false, earlySignal: false, count: 0, updatedAt: null, items: [] }),
    readJson('military-bases.json', { source: 'none', count: 0, bases: [], ts: null }),
    readJson('earthquakes.json', { source: 'none', count: 0, earthquakes: [], ts: null }),
    readJson('nuclear-facilities.json', { source: 'none', count: 0, facilities: [], ts: null })
  ]);
  res.json({ ts: Date.now(), btc, macro, flights, incidents, signals, chat, ppi, sectorHeatmap, telegramIntel, militaryBases, earthquakes, nuclearFacilities, status: state.status });
});

app.get('/api/chat', async (_req, res) => {
  res.json(await readJson('chat.json', { messages: [] }));
});

app.post('/api/chat', async (req, res) => {
  const text = String(req.body?.message || '').trim();
  if (!text) return res.status(400).json({ ok: false, error: 'message required' });

  const chat = await readJson('chat.json', { messages: [] });
  chat.messages.push({ role: 'user', text, ts: Date.now() });

  let replyText = 'Bridge temporarily unavailable. Try again in a moment.';
  try {
    const bridged = await sendToOpenClaw(text);
    if (bridged && String(bridged).trim()) replyText = String(bridged).trim();
  } catch {
    // keep sanitized fallback
  }

  const reply = { role: 'assistant', text: replyText, ts: Date.now() };
  chat.messages.push(reply);
  if (chat.messages.length > 200) chat.messages = chat.messages.slice(-200);
  await writeJson('chat.json', chat);

  res.json({ ok: true, reply, messages: chat.messages.slice(-20) });
});

// ---------- boot ----------
await ensureDataDir();

await Promise.allSettled([
  runBtcPoll(),
  runFlightsPoll(),
  runIncidentsPoll(),
  runMacroPoll(),
  runPpiPoll(),
  runSectorPoll(),
  runTelegramIntelPoll(),
  runMilitaryBasesPoll(),
  runEarthquakesPoll(),
  runNuclearFacilitiesPoll(),
rewriteNdjson('signals.ndjson', await readNdjson('signals.ndjson', []), MAX_SIGNALS)
]);

setInterval(runBtcPoll, BTC_POLL_MS);
setInterval(runFlightsPoll, FLIGHTS_POLL_MS);
setInterval(runIncidentsPoll, INCIDENTS_POLL_MS);
setInterval(runMacroPoll, MACRO_POLL_MS);
setInterval(runPpiPoll, PPI_POLL_MS);
setInterval(runSectorPoll, SECTOR_POLL_MS);
setInterval(runTelegramIntelPoll, TELEGRAM_INTEL_POLL_MS);
setInterval(runMilitaryBasesPoll, MILITARY_BASES_POLL_MS);
setInterval(runEarthquakesPoll, EARTHQUAKES_POLL_MS);
setInterval(runNuclearFacilitiesPoll, NUCLEAR_FACILITIES_POLL_MS);
if (!j7Token) await loginJ7();
startJ7Collector();

app.listen(PORT, HOST, () => {
  console.log(`[horus-relay] listening on http://${HOST}:${PORT}`);
  console.log(`[horus-relay] data dir: ${DATA_DIR}`);
});
