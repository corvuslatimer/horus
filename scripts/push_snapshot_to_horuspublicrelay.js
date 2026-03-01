#!/usr/bin/env node

const LOCAL_RELAY = process.env.LOCAL_RELAY || 'http://127.0.0.1:8787';
const PUBLIC_RELAY = process.env.PUBLIC_RELAY || 'https://api.horusintel.xyz';
const INTERVAL_MS = Number(process.env.PUSH_INTERVAL_MS || 5000);

async function tick() {
  try {
    const r = await fetch(`${LOCAL_RELAY}/api/snapshots`);
    if (!r.ok) throw new Error(`local snapshots ${r.status}`);
    const snap = await r.json();

    const p = await fetch(`${PUBLIC_RELAY}/api/ingest/snapshot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snap)
    });
    if (!p.ok) throw new Error(`public ingest snapshot ${p.status}`);
    const out = await p.json();
    console.log(`[snapshot-bridge] pushed ts=${snap?.ts || '?'} doTs=${out?.ts || '?'} ${new Date().toISOString()}`);
  } catch (e) {
    console.error('[snapshot-bridge] error', e?.message || e);
  }
}

console.log(`[snapshot-bridge] starting ${LOCAL_RELAY} -> ${PUBLIC_RELAY}`);
setInterval(tick, INTERVAL_MS);
tick();
