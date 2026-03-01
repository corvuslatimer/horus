import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const PORT = process.env.PORT || 8787;
const execFileAsync = promisify(execFile);
const HOST = process.env.HOST || '127.0.0.1';
const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL || '';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';
const OPENCLAW_SESSION_KEY = process.env.OPENCLAW_SESSION_KEY || 'agent:main:telegram:direct:5939904603';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const MIL = ['RCH','CMB','RRR','CNV','LAGR','QID','NATO','FORTE','DUKE','HOMER','MOOSE','TITAN','GHOST'];
const norm = c => (c || '').trim().toUpperCase();
const isMil = c => MIL.some(h => norm(c).startsWith(h));

async function ensureDataDir() { await fs.mkdir(DATA_DIR, { recursive: true }); }
async function writeJson(name, data) { await ensureDataDir(); await fs.writeFile(path.join(DATA_DIR, name), JSON.stringify(data, null, 2)); }
async function readJson(name, fallback = null) {
  try { return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), 'utf8')); }
  catch { return fallback; }
}

async function fetchBtc() {
  try {
    const r = await fetch('https://api.gemini.com/v2/ticker/btcusd');
    if (!r.ok) throw new Error(`gemini status ${r.status}`);
    const j = await r.json();

    // Gemini v2/ticker currently returns open/close and a changes[] array
    const last = Number(j?.last ?? j?.close ?? NaN);
    const open = Number(j?.open ?? NaN);

    let pct = Number(j?.changes?.percentChange24h ?? NaN);
    if (!Number.isFinite(pct) && Number.isFinite(open) && Number.isFinite(last) && open > 0) {
      pct = (last - open) / open;
    }

    if (!Number.isFinite(last) || last < 1000) throw new Error('invalid BTC last from Gemini');

    return { source:'gemini', last, percentChange24h:Number.isFinite(pct) ? pct : null, ts:Date.now(), raw:j };
  } catch {
    const r2 = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (!r2.ok) throw new Error(`coingecko status ${r2.status}`);
    const j2 = await r2.json();
    const last = Number(j2?.bitcoin?.usd ?? NaN);
    if (!Number.isFinite(last) || last < 1000) throw new Error('invalid BTC last from CoinGecko');
    return { source:'coingecko', last, percentChange24h:null, ts:Date.now(), raw:j2 };
  }
}

async function fetchFlights() {
  const r = await fetch('https://opensky-network.org/api/states/all');
  if (!r.ok) throw new Error(`opensky status ${r.status}`);
  const j = await r.json();
  const states = Array.isArray(j?.states) ? j.states : [];
  const flights = [];
  for (const x of states) {
    const callsign = norm(x[1]);
    const lon = x[5], lat = x[6], vel = x[9];
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    if (!isMil(callsign)) continue;
    flights.push({ callsign, lat, lon, speedKmh: typeof vel === 'number' ? Math.round(vel*3.6) : null, icao24:(x[0]||'').toUpperCase() });
    if (flights.length >= 250) break;
  }
  return { source:'opensky', count:flights.length, flights, ts:Date.now() };
}

async function refreshCaches() {
  const [btc, flights] = await Promise.allSettled([fetchBtc(), fetchFlights()]);
  if (btc.status === 'fulfilled') await writeJson('btc.json', btc.value);
  if (flights.status === 'fulfilled') await writeJson('flights.json', flights.value);
  await writeJson('meta.json', { ts:Date.now(), btcOk:btc.status==='fulfilled', flightsOk:flights.status==='fulfilled' });
}


async function sendToOpenClaw(message) {
  const sessionKey = OPENCLAW_SESSION_KEY;
  if (!sessionKey) return null;

  // Prefer local CLI gateway call (no manual token plumbing needed)
  try {
    const params = JSON.stringify({ sessionKey, message, timeoutSeconds: 45 });
    const { stdout } = await execFileAsync('openclaw', [
      'gateway', 'call', 'sessions_send', '--json', '--timeout', '70000', '--params', params
    ], { timeout: 75000, maxBuffer: 2 * 1024 * 1024 });

    const parsed = JSON.parse(stdout || '{}');
    const txt = parsed?.result?.message?.content?.[0]?.text
      || parsed?.result?.text
      || parsed?.text
      || null;
    return txt;
  } catch (_) {
    // fallback HTTP bridge if explicitly configured
    if (!OPENCLAW_BASE_URL) return null;
    const headers = { 'Content-Type': 'application/json' };
    if (OPENCLAW_TOKEN) headers['Authorization'] = `Bearer ${OPENCLAW_TOKEN}`;
    const url = `${OPENCLAW_BASE_URL.replace(/\/$/, '')}/api/tools/sessions_send`;
    const body = { sessionKey, message, timeoutSeconds: 45 };
    const r = await fetch(url, { method:'POST', headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`openclaw bridge status ${r.status}`);
    const j = await r.json();
    return j?.text || j?.result?.text || j?.output || null;
  }
}

app.get('/health', async (_req, res) => res.json({ ok:true, service:'horus-relay', ts:Date.now(), cache: await readJson('meta.json', {}) }));

app.get('/api/btc', async (_req, res) => {
  try {
    const data = await fetchBtc();
    await writeJson('btc.json', data);
    res.json(data);
  } catch (e) {
    const cached = await readJson('btc.json');
    if (cached) return res.json({ ...cached, cached:true });
    res.status(502).json({ ok:false, error:'BTC upstream unavailable', detail:String(e?.message||e) });
  }
});

app.get('/api/flights', async (_req, res) => {
  try {
    const data = await fetchFlights();
    await writeJson('flights.json', data);
    res.json(data);
  } catch (e) {
    const cached = await readJson('flights.json');
    if (cached) return res.json({ ...cached, cached:true });
    res.status(502).json({ ok:false, error:'Flights upstream unavailable', detail:String(e?.message||e) });
  }
});

app.get('/api/snapshots', async (_req, res) => {
  const [btc, flights, chat] = await Promise.all([
    readJson('btc.json', null),
    readJson('flights.json', null),
    readJson('chat.json', { messages:[] })
  ]);
  res.json({ ts:Date.now(), btc, flights, chat });
});

app.get('/api/chat', async (_req, res) => {
  res.json(await readJson('chat.json', { messages:[] }));
});

app.post('/api/chat', async (req, res) => {
  const text = String(req.body?.message || '').trim();
  if (!text) return res.status(400).json({ ok:false, error:'message required' });

  const chat = await readJson('chat.json', { messages:[] });
  chat.messages.push({ role:'user', text, ts:Date.now() });

  let replyText = 'Logged. Relay received your message.';
  try {
    const bridged = await sendToOpenClaw(text);
    if (bridged && String(bridged).trim()) replyText = String(bridged).trim();
    else if (OPENCLAW_BASE_URL && OPENCLAW_SESSION_KEY) replyText = 'Message sent to OpenClaw session. Awaiting response payload.';
    else replyText = 'Message queued, but no bridge response yet.';
  } catch (e) {
    replyText = 'Bridge error: ' + String(e?.message || e);
  }
  const reply = { role:'assistant', text: replyText, ts:Date.now() };
  chat.messages.push(reply);
  if (chat.messages.length > 200) chat.messages = chat.messages.slice(-200);
  await writeJson('chat.json', chat);

  res.json({ ok:true, reply, messages: chat.messages.slice(-20) });
});

await ensureDataDir();
await refreshCaches();
setInterval(refreshCaches, 15000);

app.listen(PORT, HOST, () => {
  console.log(`[horus-relay] listening on http://${HOST}:${PORT}`);
  console.log(`[horus-relay] caching into ${DATA_DIR}`);
});
