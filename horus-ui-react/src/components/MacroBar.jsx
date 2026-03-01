import { useState, useEffect } from 'react'
const RELAY = import.meta.env.VITE_RELAY_URL || 'http://100.83.149.17:8787'

const CHART_SYMBOL = {
  BTC: 'COINBASE:BTCUSD',
  SPY: 'AMEX:SPY',
  QQQ: 'NASDAQ:QQQ',
  DXY: 'CAPITALCOM:DXY'
}

export default function MacroBar() {
  const [btc, setBtc] = useState(null)
  const [macro, setMacro] = useState({ symbols: {} })
  const [showChart, setShowChart] = useState(false)
  const [chartKey, setChartKey] = useState('BTC')
  const [flash, setFlash] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [rb, rm] = await Promise.all([
          fetch(`${RELAY}/api/btc`),
          fetch(`${RELAY}/api/macro`)
        ])
        const next = await rb.json()
        const m = await rm.json()
        setMacro(m || { symbols: {} })
        setBtc(prev => {
          const prevPrice = Number(prev?.last || 0)
          const nextPrice = Number(next?.last || 0)
          if (prev && prevPrice > 0 && nextPrice > 0 && Math.floor(prevPrice) !== Math.floor(nextPrice)) {
            setFlash(true); setShake(true)
            setTimeout(() => setFlash(false), 260)
            setTimeout(() => setShake(false), 520)
          }
          return next
        })
      } catch {}
    }
    load(); const id = setInterval(load, 5000); return () => clearInterval(id)
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

  const pct = btc?.percentChange24h
  const up = typeof pct === 'number' && pct >= 0
  const fmtInt = (n) => Number.isFinite(Number(n)) ? Math.floor(Number(n)).toLocaleString() : '—'
  const fmtPct = (n) => Number.isFinite(Number(n)) ? `${Number(n) >= 0 ? '+' : ''}${Number(n).toFixed(2)}%` : null

  const openChart = (k) => { setChartKey(k); setShowChart(true) }

  return (
    <>
      <style>{`
        @keyframes horusShake {
          0% { transform: translateX(0); }
          20% { transform: translateX(-2px); }
          40% { transform: translateX(2px); }
          60% { transform: translateX(-1px); }
          80% { transform: translateX(1px); }
          100% { transform: translateX(0); }
        }
      `}</style>
      <div style={{borderTop:'1px solid #1a1a1a',background:'#0b0b0b',padding:'8px 10px',flexShrink:0}}>
        <div style={{fontSize:9,letterSpacing:2,color:'#888',marginBottom:7}}>MAJOR INDICES</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
          <MacroItem label="BTCUSD" value={btc?`$${fmtInt(btc.last)}`:'--'} change={typeof pct==='number'?`${up?'+':''}${(pct*100).toFixed(2)}%`:null} up={up} onClick={() => openChart('BTC')} flash={flash} shake={shake} />
          <MacroItem label="SPY" value={fmtInt(macro?.symbols?.SPY?.current)} change={fmtPct(macro?.symbols?.SPY?.percent)} up={Number(macro?.symbols?.SPY?.percent || 0) >= 0} onClick={() => openChart('SPY')} />
          <MacroItem label="QQQ" value={fmtInt(macro?.symbols?.QQQ?.current)} change={fmtPct(macro?.symbols?.QQQ?.percent)} up={Number(macro?.symbols?.QQQ?.percent || 0) >= 0} onClick={() => openChart('QQQ')} />
          <MacroItem label="UUP" value={fmtInt(macro?.symbols?.DXY?.current)} change={fmtPct(macro?.symbols?.DXY?.percent)} up={Number(macro?.symbols?.DXY?.percent || 0) >= 0} onClick={() => openChart('DXY')} />
        </div>
      </div>

      {showChart && (
        <div onClick={() => setShowChart(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={(e) => e.stopPropagation()} style={{width:'min(1100px, 95vw)',height:'min(760px, 90vh)',background:'#0F0F0F',border:'1px solid #2a2a2a',borderRadius:10,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderBottom:'1px solid #1f1f1f'}}>
              <div style={{fontSize:12,color:'#ddd',fontWeight:600}}>{chartKey === 'DXY' ? 'UUP' : chartKey} Chart</div>
              <button onClick={() => setShowChart(false)} style={{background:'#1b1b1b',color:'#bbb',border:'1px solid #333',borderRadius:6,padding:'4px 8px',cursor:'pointer'}}>Close</button>
            </div>
            <div style={{flex:1,minHeight:0,padding:10}}>
              <div className="tradingview-widget-container" style={{height:'100%',width:'100%'}}>
                <div id="tv-btc-widget" className="tradingview-widget-container__widget" style={{height:'calc(100% - 32px)',width:'100%'}}></div>
                <div className="tradingview-widget-copyright" style={{fontSize:11,color:'#777',paddingTop:8}}>
                  <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank" style={{color:'#5aa2ff',textDecoration:'none'}}>Chart data</a>
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

function MacroItem({ label, value, change, up, onClick, flash = false, shake = false }) {
  return (
    <div onClick={onClick} style={{border:'1px solid #1a1a1a',background: flash ? '#000' : '#0f0f0f',padding:'6px 8px',borderRadius:4,cursor:onClick?'pointer':'default',boxShadow:flash?'inset 0 0 0 1px rgba(255,255,255,0.15)':'none',transform:shake?'translateX(0)':'none',animation:shake?'horusShake 0.45s ease':'none',transition:'background 0.18s ease, box-shadow 0.18s ease'}}>
      <div style={{fontSize:10,color:'#777',marginBottom:3}}>{label}</div>
      <div style={{fontSize:12,color:change?(up?'#50c050':'#e05050'):'#ddd',fontWeight:600}}>{value}{change&&<span style={{fontSize:10,marginLeft:4}}> {change}</span>}</div>
    </div>
  )
}
