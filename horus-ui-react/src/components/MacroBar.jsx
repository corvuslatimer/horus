import { useState, useEffect } from 'react'
const RELAY = import.meta.env.VITE_RELAY_URL || 'http://100.83.149.17:8787'

const CHART_SYMBOL = {
  BTC: 'COINBASE:BTCUSD',
  SPY: 'AMEX:SPY',
  QQQ: 'NASDAQ:QQQ',
  DXY: 'AMEX:UUP',
  AAPL: 'NASDAQ:AAPL',
  MSFT: 'NASDAQ:MSFT',
  NVDA: 'NASDAQ:NVDA',
  SOL: 'BINANCE:SOLUSDT',
  GOLD: 'PEPPERSTONE:XAUUSD',
  OIL: 'AMEX:OILT',
}

const MARKET_ITEMS = [
  { key: 'BTC', label: 'BTCUSD', prefix: '$' },
  { key: 'SPY', label: 'SPY', prefix: '$' },
  { key: 'QQQ', label: 'QQQ', prefix: '$' },
  { key: 'DXY', label: 'UUP', prefix: '$' },
  { key: 'AAPL', label: 'AAPL', prefix: '$' },
  { key: 'MSFT', label: 'MSFT', prefix: '$' },
  { key: 'NVDA', label: 'NVDA', prefix: '$' },
  { key: 'SOL', label: 'SOLUSD', prefix: '$' },
  { key: 'GOLD', label: 'GOLD', prefix: '$' },
  { key: 'OIL', label: 'OIL', prefix: '$' },
]

export default function MacroBar() {
  const [symbols, setSymbols] = useState({})
  const [showChart, setShowChart] = useState(false)
  const [chartKey, setChartKey] = useState('BTC')

  useEffect(() => {
    const load = async () => {
      try {
        const [rm, rb, rs] = await Promise.all([
          fetch(`${RELAY}/api/macro`),
          fetch(`${RELAY}/api/btc`),
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true')
        ])
        const j = await rm.json()
        const b = await rb.json()
        const sol = await rs.json()
        const next = { ...(j?.symbols || {}) }
        if (Number.isFinite(Number(b?.last))) {
          next.BTC = { current: Number(b.last), percent: Number.isFinite(Number(b?.percentChange24h)) ? Number(b.percentChange24h) * 100 : next?.BTC?.percent ?? null }
        }
        if (Number.isFinite(Number(sol?.solana?.usd))) {
          next.SOL = { current: Number(sol.solana.usd), percent: Number.isFinite(Number(sol?.solana?.usd_24h_change)) ? Number(sol.solana.usd_24h_change) : null }
        }
        setSymbols(next)
      } catch {}
    }

    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!showChart) return
    const container = document.getElementById('tv-btc-widget')
    if (!container) return
    container.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.type = 'text/javascript'
    script.innerHTML = JSON.stringify({
      allow_symbol_change: false,
      calendar: false,
      details: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: true,
      hide_volume: false,
      hotlist: false,
      interval: '1',
      locale: 'en',
      save_image: true,
      style: '1',
      symbol: CHART_SYMBOL[chartKey] || CHART_SYMBOL.BTC,
      theme: 'dark',
      timezone: 'Etc/UTC',
      backgroundColor: '#0F0F0F',
      gridColor: 'rgba(242, 242, 242, 0.06)',
      watchlist: [],
      withdateranges: true,
      compareSymbols: [],
      studies: [],
      autosize: true
    })
    container.appendChild(script)
  }, [showChart, chartKey])

  const fmtPrice = (v, prefix = '$') => {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) return `${prefix}—`
    if (Math.abs(n) >= 1000) return `${prefix}${Math.floor(n).toLocaleString()}`
    if (Math.abs(n) >= 100) return `${prefix}${n.toFixed(2)}`
    return `${prefix}${n.toFixed(3)}`
  }

  const fmtPct = (n) => Number.isFinite(Number(n)) ? `${Number(n) >= 0 ? '+' : ''}${Number(n).toFixed(2)}%` : null

  const openChart = (k) => { setChartKey(k); setShowChart(true) }

  return (
    <>
      <div style={{ borderTop: '1px solid #1a1a1a', background: '#0b0b0b', padding: '6px 8px', flexShrink: 0 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: '#888', marginBottom: 7 }}>MARKETS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxHeight: 170, overflowY: 'auto', paddingRight: 2 }}>
          {MARKET_ITEMS.map((m) => {
            const row = symbols?.[m.key] || {}
            const pct = fmtPct(row.percent)
            const up = Number(row.percent || 0) >= 0
            return (
              <MacroItem
                key={m.key}
                ticker={m.label}
                value={fmtPrice(row.current, m.prefix)}
                change={pct}
                up={up}
                onClick={() => openChart(m.key)}
              />
            )
          })}
        </div>
      </div>

      {showChart && (
        <div onClick={() => setShowChart(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(1100px, 95vw)', height: 'min(760px, 90vh)', background: '#0F0F0F', border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #1f1f1f' }}>
              <div style={{ fontSize: 12, color: '#ddd', fontWeight: 600 }}>{chartKey} Chart</div>
              <button onClick={() => setShowChart(false)} style={{ background: '#1b1b1b', color: '#bbb', border: '1px solid #333', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>Close</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: 10 }}>
              <div className="tradingview-widget-container" style={{ height: '100%', width: '100%' }}>
                <div id="tv-btc-widget" className="tradingview-widget-container__widget" style={{ height: 'calc(100% - 32px)', width: '100%' }}></div>
                <div className="tradingview-widget-copyright" style={{ fontSize: 11, color: '#777', paddingTop: 8 }}>
                  <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank" style={{ color: '#5aa2ff', textDecoration: 'none' }}>Chart data</a>
                  <span className="trademark"> by TradingView</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MacroItem({ ticker, value, change, up, onClick }) {
  return (
    <div onClick={onClick} style={{ border: '1px solid #1a1a1a', background: '#0f0f0f', padding: '5px 7px', borderRadius: 4, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', columnGap: 10 }}>
        <span style={{ fontSize: 10, color: '#777', fontWeight: 600 }}>{ticker}</span>
        <span style={{ fontSize: 12, color: '#ddd', fontWeight: 600 }}>{value}</span>
        <span style={{ fontSize: 10, color: change ? (up ? '#50c050' : '#e05050') : '#777', fontWeight: 600 }}>{change || '—'}</span>
      </div>
    </div>
  )
}
