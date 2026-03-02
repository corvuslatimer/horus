import { useEffect, useMemo, useState } from 'react'
const RELAY = import.meta.env.VITE_RELAY_URL || 'http://100.83.149.17:8787'

const TOPICS = ['all', 'breaking', 'conflict', 'alerts', 'osint', 'politics', 'middleeast']

function ago(ts) {
  if (!ts) return 'now'
  const d = Date.now() - new Date(ts).getTime()
  if (d < 60_000) return `${Math.max(1, Math.floor(d / 1000))}s`
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`
  return `${Math.floor(d / 86_400_000)}d`
}

export default function TelegramIntelPanel() {
  const [data, setData] = useState({ enabled: false, items: [], count: 0 })
  const [topic, setTopic] = useState('all')

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${RELAY}/api/telegram-intel`)
        const j = await r.json()
        setData({ enabled: Boolean(j?.enabled), items: j?.items || [], count: Number(j?.count || 0) })
      } catch {}
    }
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const filtered = useMemo(() => {
    if (topic === 'all') return data.items
    return data.items.filter(i => String(i.topic || '').toLowerCase() === topic)
  }, [data.items, topic])

  return (
    <div style={{ height: 320, borderTop: '1px solid #1a1a1a', background: '#0b0b0b', padding: '8px 10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 1.8, color: '#888', marginBottom: 6, display:'flex', justifyContent:'space-between' }}>
        <span>TELEGRAM INTEL</span>
        <span style={{color:'#666'}}>{data.enabled ? `${data.count} signals` : 'relay off'}</span>
      </div>

      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
        {TOPICS.map(t => (
          <button key={t} onClick={() => setTopic(t)} style={{fontSize:10, padding:'2px 6px', borderRadius:4, cursor:'pointer', border:`1px solid ${topic===t?'#355170':'#2a2a2a'}`, background: topic===t?'#1f3a5a':'#111', color:'#ccc'}}>{t}</button>
        ))}
      </div>

      <div style={{ flex:1, minHeight:0, overflowY:'auto', border:'1px solid #1a1a1a', borderRadius:6, background:'#0f0f0f' }}>
        {!data.enabled && <div style={{padding:10, color:'#777', fontSize:11}}>Telegram relay not active</div>}
        {data.enabled && filtered.length === 0 && <div style={{padding:10, color:'#777', fontSize:11}}>No telegram intel yet</div>}
        {data.enabled && filtered.slice(0, 40).map((it, idx) => (
          <a key={it.id || idx} href={it.url || '#'} target="_blank" rel="noreferrer" style={{display:'block', textDecoration:'none', color:'#ddd', borderBottom:'1px solid #171717', padding:'7px 8px'}}>
            <div style={{display:'flex', gap:6, fontSize:10, color:'#8aa1c8', marginBottom:3}}>
              <span>{it.channelTitle || it.channel || 'telegram'}</span>
              <span style={{color:'#666'}}>·</span>
              <span>{it.topic || 'all'}</span>
              <span style={{marginLeft:'auto', color:'#666'}}>{ago(it.ts)}</span>
            </div>
            <div style={{fontSize:11, lineHeight:1.35, color:'#d6d6d6'}}>{it.text}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
