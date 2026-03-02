import { useMemo, useState } from 'react'

const BASE_ITEMS = [
  { name: 'Extreme Pizza', status: 'ELEVATED', score: 65 },
  { name: 'District Pizza Palace', status: 'QUIET', score: 0 },
  { name: 'We, The Pizza', status: 'CLOSED', score: null },
  { name: 'Papa Johns Pizza', status: 'QUIET', score: 3 },
  { name: 'Pizzato Pizza', status: 'NORMAL', score: 31 }
]

function statusColor(status) {
  if (status === 'ELEVATED') return { bg: '#f59e0b22', fg: '#fbbf24', border: '#f59e0b66' }
  if (status === 'QUIET') return { bg: '#22c55e22', fg: '#86efac', border: '#22c55e66' }
  if (status === 'CLOSED') return { bg: '#6b728022', fg: '#9ca3af', border: '#6b728066' }
  return { bg: '#0ea5e922', fg: '#7dd3fc', border: '#0ea5e966' }
}

export default function PentagonPizzaPanel() {
  const [open, setOpen] = useState(true)
  const updatedText = useMemo(() => 'Updated just now', [])

  return (
    <div style={{ borderTop: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a', background: '#0b0b0b', flexShrink: 0 }}>
      <div style={{ padding: '7px 10px', borderBottom: '1px solid #151515', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#7dd3fc', border: '1px solid #0ea5e955', background: '#082f49', padding: '2px 6px', borderRadius: 4 }}>DEFCON 4</span>
        <span style={{ fontSize: 10, color: '#999' }}>22%</span>
        <button
          onClick={() => setOpen(v => !v)}
          style={{ marginLeft: 'auto', border: '1px solid #2a2a2a', background: '#111', color: '#999', borderRadius: 4, fontSize: 10, cursor: 'pointer', padding: '2px 6px' }}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #161616' }}>
            <div style={{ color: '#ddd', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Pentagon Pizza Index</div>
            <div style={{ color: '#3fa7ff', textAlign: 'center', fontSize: 12, letterSpacing: 1.2, fontWeight: 700, padding: '8px 6px', border: '1px solid #1e3a8a44', background: '#050913' }}>
              DOUBLE TAKE — INCREASED INTELLIGENCE WATCH
            </div>
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {BASE_ITEMS.map((x) => {
              const c = statusColor(x.status)
              return (
                <div key={x.name} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: '9px 12px', borderBottom: '1px solid #141414' }}>
                  <span style={{ color: '#ddd', fontSize: 13 }}>{x.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.fg, border: `1px solid ${c.border}`, background: c.bg, borderRadius: 4, padding: '2px 6px' }}>
                    {x.status}{typeof x.score === 'number' ? ` ${x.score}%` : ''}
                  </span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', color: '#666', fontSize: 10 }}>
            <span>Source: PizzINT</span>
            <span>{updatedText}</span>
          </div>
        </>
      )}
    </div>
  )
}
