import { useState, useEffect } from 'react'
const RELAY = import.meta.env.VITE_RELAY_URL || 'http://100.83.149.17:8787'

export default function MacroBar() {
  const [btc, setBtc] = useState(null)
  useEffect(() => {
    const load = async () => { try { const r = await fetch(`${RELAY}/api/btc`); setBtc(await r.json()) } catch {} }
    load(); const id = setInterval(load,5000); return () => clearInterval(id)
  }, [])
  const pct = btc?.percentChange24h
  const up = typeof pct === 'number' && pct >= 0
  return (
    <div style={{borderTop:'1px solid #1a1a1a',background:'#0b0b0b',padding:'8px 10px',flexShrink:0}}>
      <div style={{fontSize:9,letterSpacing:2,color:'#888',marginBottom:7}}>MAJOR INDICES</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        <MacroItem label="BTC/USD" value={btc?`$${Number(btc.last).toLocaleString(undefined,{maximumFractionDigits:2})}`:'--'} change={typeof pct==='number'?`${up?'+':''}${(pct*100).toFixed(2)}%`:null} up={up}/>
        <MacroItem label="S&P 500" value="—"/>
        <MacroItem label="NASDAQ" value="—"/>
        <MacroItem label="DXY" value="—"/>
      </div>
    </div>
  )
}
function MacroItem({label,value,change,up}) {
  return (
    <div style={{border:'1px solid #1a1a1a',background:'#0f0f0f',padding:'6px 8px',borderRadius:4}}>
      <div style={{fontSize:10,color:'#777',marginBottom:3}}>{label}</div>
      <div style={{fontSize:12,color:change?(up?'#50c050':'#e05050'):'#ddd',fontWeight:600}}>
        {value}{change&&<span style={{fontSize:10,marginLeft:4}}>{change}</span>}
      </div>
    </div>
  )
}
