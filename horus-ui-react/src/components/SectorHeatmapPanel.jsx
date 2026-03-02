import { useEffect, useState } from 'react'
const RELAY = import.meta.env.VITE_RELAY_URL || 'http://100.83.149.17:8787'

function cellStyle(v) {
  const up = v >= 0
  const mag = Math.min(1, Math.abs(v) / 3)
  if (up) {
    const bg = `rgba(16, 185, 129, ${0.12 + mag * 0.26})`
    return { color: '#86efac', bg, border: 'rgba(16,185,129,0.30)' }
  }
  const bg = `rgba(239, 68, 68, ${0.10 + mag * 0.26})`
  return { color: '#fca5a5', bg, border: 'rgba(239,68,68,0.30)' }
}

export default function SectorHeatmapPanel() {
  const [sectors, setSectors] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${RELAY}/api/sector-heatmap`)
        const j = await r.json()
        setSectors(j?.sectors || [])
      } catch {}
    }
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ height: 140, borderTop: '1px solid #1a1a1a', background: '#0b0b0b', padding: '6px 8px', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ fontSize: 10, letterSpacing: 1.8, color: '#888', marginBottom: 5 }}>SECTOR HEATMAP</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, maxHeight: 138, overflowY: 'auto', paddingRight: 2 }}>
        {sectors.map((s) => {
          const val = Number(s.value || 0)
          const st = cellStyle(val)
          return (
            <div key={s.name} style={{ border: `1px solid ${st.border}`, background: st.bg, borderRadius: 6, padding: '4px 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#c7c7c7', whiteSpace: 'normal' }}>{s.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color, whiteSpace: 'normal' }}>{val >= 0 ? '+' : ''}{val.toFixed(2)}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
