import { useEffect, useState } from 'react'
const RELAY = import.meta.env.VITE_RELAY_URL || 'http://100.83.149.17:8787'

function ppiStatusColor(status) {
  if (status === 'ELEVATED') return '#fbbf24'
  if (status === 'QUIET') return '#86efac'
  if (status === 'CLOSED') return '#9ca3af'
  return '#7dd3fc'
}

export default function Header({ feedStatus, onToggleLiveFeeds }) {
  const [time, setTime] = useState('')
  const [showPpi, setShowPpi] = useState(false)
  const [ppi, setPpi] = useState({ weightedAvg: 0, locations: [] })

  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setTime([n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds()].map(x => String(x).padStart(2, '0')).join(':') + ' UTC')
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${RELAY}/api/ppi`)
        const j = await r.json()
        setPpi({ weightedAvg: Number(j?.weightedAvg || 0), locations: j?.locations || [] })
      } catch (err) { console.debug(err) }
    }
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [])

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #1e1e1e', background: '#0d0d0d', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <svg viewBox="0 0 48 28" width="36" height="21" fill="none">
          <path d="M24 4C13 4 4 14 4 14s9 10 20 10 20-10 20-10S35 4 24 4z" stroke="#c8a84b" strokeWidth="2" />
          <circle cx="24" cy="14" r="5" fill="#c8a84b" />
          <circle cx="24" cy="14" r="2.2" fill="#0a0a0a" />
          <line x1="24" y1="19" x2="22" y2="26" stroke="#c8a84b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontWeight: 700, letterSpacing: 5, color: '#c8a84b', fontSize: 20 }}>HORUS</span>
        <a
          href="https://github.com/corvuslatimer/horus"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Horus GitHub Repository"
          title="Horus GitHub Repository"
          style={{ color: '#bfc7d8', textDecoration: 'none', border: '1px solid #2a2a2a', background: '#111', padding: '4px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
        </a>

        <button onClick={onToggleLiveFeeds} style={{ cursor: 'pointer', borderRadius: 6, border: '1px solid #2a3a66', background: '#101426', color: '#cfe3ff', fontSize: 11, padding: '4px 8px' }}>
          Live Feeds
        </button>

        <div onMouseEnter={() => setShowPpi(true)} onMouseLeave={() => setShowPpi(false)} style={{ position: 'relative', cursor: 'default' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#fbbf24' }}>
            <span style={{ fontWeight: 700 }}>PPI</span>
            <span style={{ color: '#ddd' }}>{ppi.weightedAvg}%</span>
          </div>

          {showPpi && (
            <div style={{ position: 'absolute', right: 0, top: '120%', minWidth: 280, background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 8, padding: 10, zIndex: 1200, boxShadow: '0 8px 28px rgba(0,0,0,.45)' }}>
              <div style={{ fontSize: 11, color: '#ddd', fontWeight: 700, marginBottom: 6 }}>Pentagon Pizza Index</div>
              <div style={{ fontSize: 10, color: '#777', marginBottom: 8 }}>Weighted average: {ppi.weightedAvg}%</div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {ppi.locations.map((x) => (
                  <div key={x.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a1a1a' }}>
                    <span style={{ color: '#d4d4d4' }}>{x.name}</span>
                    <span style={{ color: ppiStatusColor(x.status), fontWeight: 700 }}>{x.status}{typeof x.score === 'number' ? ` ${x.score}%` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#888', alignItems: 'center' }}>
        <StatusItem label="FEED" status={feedStatus} />


        <span>{time}</span>
      </div>
    </header>
  )
}

function StatusItem({ label, status }) {
  const color = status === 'live' ? '#4caf50' : status === 'connecting' ? '#f0a500' : '#555'
  const shadow = status === 'live' ? '0 0 6px #4caf50' : status === 'connecting' ? '0 0 6px #f0a500' : 'none'
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: shadow }} />
      <span>{status === 'live' ? 'LIVE' : status === 'connecting' ? 'CONNECTING' : label}</span>
    </div>
  )
}
