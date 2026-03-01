#!/usr/bin/env node

const LOCAL_RELAY = process.env.LOCAL_RELAY || 'http://127.0.0.1:8787';
const PUBLIC_RELAY = process.env.PUBLIC_RELAY || 'https://api.horusintel.xyz';
const INTERVAL_MS = Number(process.env.PUSH_INTERVAL_MS || 1000);
const INGEST_TOKEN = process.env.INGEST_TOKEN || '';

function slimSnapshot(snap) {
  const s = { ...snap };
  // keep payload bounded
  if (s?.signals?.signals?.length > 500) s.signals.signals = s.signals.signals.slice(0, 500);
  if (s?.incidents?.articles?.length > 300) s.incidents.articles = s.incidents.articles.slice(0, 300);
  if (s?.flights?.flights?.length > 500) s.flights.flights = s.flights.flights.slice(0, 500);
  return s;
}

async function tick() {
  try {
    const r = await fetch(`${LOCAL_RELAY}/api/snapshots`);
    if (!r.ok) throw new Error(`local snapshots ${r.status}`);
    const snap = slimSnapshot(await r.json());

    const headers = { 'content-type': 'application/json' };
    if (INGEST_TOKEN) headers['authorization'] = `Bearer ${INGEST_TOKEN}`;

    const p = await fetch(`${PUBLIC_RELAY}/api/ingest/snapshot`, {
      method: 'POST',
      headers,
      body: JSON.stringify(snap)
    });
    if (!p.ok) {
      const t = await p.text().catch(() => '');
      throw new Error(`public ingest snapshot ${p.status} ${t.slice(0,120)}`);
    }
    const out = await p.json();
    console.log(`[snapshot-bridge] pushed ts=${snap?.ts || '?'} doTs=${out?.ts || '?'} ${new Date().toISOString()}`);
  } catch (e) {
    console.error('[snapshot-bridge] error', e?.message || e);
  }
}

console.log(`[snapshot-bridge] starting ${LOCAL_RELAY} -> ${PUBLIC_RELAY} @${INTERVAL_MS}ms`);
setInterval(tick, INTERVAL_MS);
tick();
