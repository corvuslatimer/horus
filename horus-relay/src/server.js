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
let j7Token = process.env.J7_TOKEN || '';
let j7TokenExpAt = null;
const BTC_POLL_MS = Number(process.env.BTC_POLL_MS || 5000);
const FLIGHTS_POLL_MS = Number(process.env.FLIGHTS_POLL_MS || 30000);
const INCIDENTS_POLL_MS = Number(process.env.INCIDENTS_POLL_MS || 60000);
const MAX_SIGNALS = Number(process.env.MAX_SIGNALS || 500);
const FINNHUB_KEY = process.env.FINNHUB_KEY || '';

const execFileAsync = promisify(execFile);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const state = {
  status: {
    startedAt: Date.now(),
    j7: { connected: false, lastConnectAt: null, lastError: null },
    pollers: { btc: null, flights: null, incidents: null },
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
  const r = await fetch('https://opensky-network.org/api/states/all');
  const j = await r.json();
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
    if (flights.length >= 250) break;
  }
  return { source: 'opensky', count: flights.length, flights, ts: Date.now(), iso: nowIso() };
}

async function fetchIncidents() {
  const feeds = [
    { source: 'reuters', url: 'https://www.reuters.com/arc/outboundfeeds/news-rss/?outputType=xml' },
    { source: 'reuters-breakingviews', url: 'https://www.reuters.com/arc/outboundfeeds/rss/category/breakingviews/?outputType=xml' },
    { source: 'aljazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { source: 'bbc-world', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
    { source: 'defensenews', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml' },
    { source: 'politico-defense', url: 'http://rss.politico.com/defense.xml' },
    { source: 'bloomberg-markets', url: 'https://www.bloomberg.com/feeds/markets/news.rss' },
    { source: 'jpost', url: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx' },
    { source: 'timesofisrael', url: 'https://www.timesofisrael.com/feed/' },
    { source: 'kyiv-independent', url: 'https://kyivindependent.com/news-archive/rss/' },
    { source: 'ukrainska-pravda', url: 'https://www.pravda.com.ua/eng/rss/' },
    { source: 'crisisgroup', url: 'https://www.crisisgroup.org/rss/139' },
    { source: 'financialjuice', url: 'https://www.financialjuice.com/feed.ashx?xy=rss' }
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



async function fetchMacro() {
  const out = { ts: Date.now(), iso: nowIso(), symbols: {} };
  if (!FINNHUB_KEY) return out;

  const targets = [
    { key: 'SPY', symbol: 'SPY' },
    { key: 'QQQ', symbol: 'QQQ' },
    { key: 'DXY', symbol: 'UUP' }
  ];

  const settled = await Promise.allSettled(targets.map(async (t) => {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(t.symbol)}&token=${FINNHUB_KEY}`);
    if (!r.ok) throw new Error(`${t.symbol} status ${r.status}`);
    const j = await r.json();
    return { key: t.key, quote: j };
  }));

  for (const row of settled) {
    if (row.status === 'fulfilled') {
      const q = row.value.quote || {};
      out.symbols[row.value.key] = {
        current: Number(q.c || 0),
        change: Number(q.d || 0),
        percent: Number(q.dp || 0)
      };
    }
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
      setTimeout(() => { if (j7Token) ws.send(`42["user_connected","${j7Token}"]`); }, 500);
    });

    ws.on('message', async (buf) => {
      const raw = String(buf);
      if (raw === '2') {
        ws.send('3');
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
  const fast = (incidents.articles || [])
    .filter(a => ['jpost', 'financialjuice'].includes(String(a.source || '').toLowerCase()))
    .slice(0, 120)
    .map(a => ({
      id: `rss-${a.url || `${a.title}|${a.seendate}`}`,
      type: 'geo',
      author: a.source === 'financialjuice' ? 'FinancialJuice' : 'Jerusalem Post',
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
  const params = JSON.stringify({ idempotencyKey, sessionKey, message });

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

app.get('/api/markets', async (_req, res) => {
  const markets = await readJson('markets.json', { markets: [], ts: null });
  res.json(markets.markets || []);
});

app.get('/api/signals', async (_req, res) => {
  const signals = await readNdjson('signals.ndjson', []);
  res.json({ source: 'mixed', signals: signals.sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0, MAX_SIGNALS), ts: Date.now(), iso: nowIso() });
});

app.get('/api/snapshots', async (_req, res) => {
  const [btc, macro, flights, incidents, signals, chat] = await Promise.all([
    readJson('btc.json', null),
    readJson('macro.json', null),
    readJson('flights.json', null),
    readJson('incidents.json', null),
    (async () => ({ source: 'mixed', signals: await readNdjson('signals.ndjson', []), ts: Date.now() }))(),
    readJson('chat.json', { messages: [] })
  ]);
  res.json({ ts: Date.now(), btc, macro, flights, incidents, signals, chat, status: state.status });
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
rewriteNdjson('signals.ndjson', await readNdjson('signals.ndjson', []), MAX_SIGNALS)
]);

setInterval(runBtcPoll, BTC_POLL_MS);
setInterval(runFlightsPoll, FLIGHTS_POLL_MS);
setInterval(runIncidentsPoll, INCIDENTS_POLL_MS);
setInterval(runMacroPoll, 15000);
if (!j7Token) await loginJ7();
startJ7Collector();

app.listen(PORT, HOST, () => {
  console.log(`[horus-relay] listening on http://${HOST}:${PORT}`);
  console.log(`[horus-relay] data dir: ${DATA_DIR}`);
});
