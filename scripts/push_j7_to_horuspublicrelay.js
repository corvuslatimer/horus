#!/usr/bin/env node

const LOCAL_RELAY = process.env.LOCAL_RELAY || 'http://127.0.0.1:8787';
const PUBLIC_RELAY = process.env.PUBLIC_RELAY || 'https://api.horusintel.xyz';
const INTERVAL_MS = Number(process.env.PUSH_INTERVAL_MS || 4000);

const seen = new Set();

function isLikelyJ7(sig) {
  const id = String(sig?.id || '');
  const src = String(sig?.source || '').toLowerCase();
  if (!id || id.startsWith('rss-')) return false;
  if (src === 'financialjuice' || src === 'telegram') return false;
  return true;
}

async function tick() {
  try {
    const r = await fetch(`${LOCAL_RELAY}/api/signals`);
    if (!r.ok) throw new Error(`local signals ${r.status}`);
    const j = await r.json();
    const signals = Array.isArray(j?.signals) ? j.signals : [];

    const batch = [];
    for (const s of signals) {
      if (!isLikelyJ7(s)) continue;
      const id = String(s.id);
      if (seen.has(id)) continue;
      seen.add(id);
      batch.push({ id, author: s.author || '@j7', text: s.text || '', url: s.url || null, ts: Number(s.ts || Date.now()) });
      if (batch.length >= 80) break;
    }

    if (!batch.length) return;

    const p = await fetch(`${PUBLIC_RELAY}/api/ingest/j7`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: batch })
    });
    if (!p.ok) throw new Error(`public ingest ${p.status}`);
    const out = await p.json();
    console.log(`[ingest] pushed=${batch.length} total=${out?.count ?? '?'} at=${new Date().toISOString()}`);

    if (seen.size > 5000) {
      const keep = new Set(Array.from(seen).slice(-2000));
      seen.clear();
      for (const k of keep) seen.add(k);
    }
  } catch (e) {
    console.error('[ingest] error', e?.message || e);
  }
}

console.log(`[ingest] starting bridge local=${LOCAL_RELAY} -> public=${PUBLIC_RELAY}`);
setInterval(tick, INTERVAL_MS);
tick();
