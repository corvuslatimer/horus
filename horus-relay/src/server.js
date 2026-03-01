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

const J7_TOKEN = process.env.J7_TOKEN || '';
const BTC_POLL_MS = Number(process.env.BTC_POLL_MS || 5000);
const FLIGHTS_POLL_MS = Number(process.env.FLIGHTS_POLL_MS || 30000);
const INCIDENTS_POLL_MS = Number(process.env.INCIDENTS_POLL_MS || 60000);
const MAX_SIGNALS = Number(process.env.MAX_SIGNALS || 500);

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
    { source: 'aljazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { source: 'bbc-world', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
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
    state.status.pollers.incidents = { ok: true, at: Date.now(), source: data.source, count: data.articles.length };
  } catch (e) {
    state.status.pollers.incidents = { ok: false, at: Date.now(), err: String(e?.message || e) };
  }
}

// ---------- J7 signals collector ----------
function startJ7Collector() {
  if (!J7_TOKEN) {
    state.status.j7.lastError = 'J7_TOKEN missing';
    return;
  }

  const connect = () => {
    const ws = new WebSocket('wss://j7tracker.io/socket.io/?EIO=4&transport=websocket');

    ws.on('open', () => {
      state.status.j7.connected = true;
      state.status.j7.lastConnectAt = Date.now();
      ws.send('40');
      setTimeout(() => ws.send(`42["user_connected","${J7_TOKEN}"]`), 500);
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

        const current = await readJson('signals.json', { source: 'j7', signals: [] });
        const sig = {
          id: data.id || data.tweetId || null,
          type: 'tweet',
          author: data.author ? `@${data.author.handle}` : 'unknown',
          text: data.text,
          url: data.tweetUrl || null,
          ts: Date.now(),
          iso: nowIso()
        };

        const exists = current.signals.some(s => (sig.id && s.id === sig.id) || (s.author === sig.author && s.text === sig.text));
        if (!exists) {
          current.signals.unshift(sig);
          current.signals = current.signals.slice(0, MAX_SIGNALS);
          current.source = 'j7';
          current.ts = Date.now();
          await writeJson('signals.json', current);
        }
      } catch {
        // ignore malformed packet
      }
    });

    ws.on('close', () => {
      state.status.j7.connected = false;
      setTimeout(connect, 3000);
    });

    ws.on('error', (e) => {
      state.status.j7.lastError = String(e?.message || e);
      ws.close();
    });
  };

  connect();
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
  const sig = await readJson('signals.json', { source: 'none', signals: [], ts: null });
  res.json(sig);
});

app.get('/api/snapshots', async (_req, res) => {
  const [btc, flights, incidents, signals, chat] = await Promise.all([
    readJson('btc.json', null),
    readJson('flights.json', null),
    readJson('incidents.json', null),
    readJson('signals.json', null),
    readJson('chat.json', { messages: [] })
  ]);
  res.json({ ts: Date.now(), btc, flights, incidents, signals, chat, status: state.status });
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
  writeJson('signals.json', await readJson('signals.json', { source: 'j7', signals: [], ts: Date.now() }))
]);

setInterval(runBtcPoll, BTC_POLL_MS);
setInterval(runFlightsPoll, FLIGHTS_POLL_MS);
setInterval(runIncidentsPoll, INCIDENTS_POLL_MS);
startJ7Collector();

app.listen(PORT, HOST, () => {
  console.log(`[horus-relay] listening on http://${HOST}:${PORT}`);
  console.log(`[horus-relay] data dir: ${DATA_DIR}`);
});
