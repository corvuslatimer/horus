import { useState, useEffect } from 'react'

export default function MarketPanel({ onStatusChange }) {
  const [markets, setMarkets] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('https://gamma-api.polymarket.com/markets?limit=25&active=true&order=volume&ascending=false')
        const mk = await r.json()
        onStatusChange('live')
        setMarkets(mk.filter(m => { try { JSON.parse(m.outcomePrices); return true } catch { return false } }))
      } catch { onStatusChange('error') }
    }
    load(); const id = setInterval(load,30000); return () => clearInterval(id)
  }, [])

  const esc = s => String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;')

  return (
    <div style={{display:'flex',flexDirection:'column',flex:3,minHeight:0}}>
      <div style={{padding:'9px 14px',fontSize:10,letterSpacing:2,color:'#888',textTransform:'uppercase',borderBottom:'1px solid #1a1a1a',display:'flex',justifyContent:'space-between',flexShrink:0}}>
        <span>POLYMARKET — LIVE ODDS</span>
        <span style={{color:'#c8a84b'}}>{markets.length} markets</span>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {markets.map((m,i) => {
          let y=null,n=null; try{const p=JSON.parse(m.outcomePrices);y=p[0];n=p[1]}catch{}
          if(!y) return null
          const yp=Math.round(parseFloat(y)*100), np=Math.round(parseFloat(n||0)*100)
          const vol=m.volume?'$'+Number(m.volume).toLocaleString(undefined,{maximumFractionDigits:0}):'—'
          return (
            <div key={i} style={{padding:'12px 14px',borderBottom:'1px solid #111'}}>
              <div style={{fontSize:11,color:'#ddd',fontWeight:500,marginBottom:8,lineHeight:1.4}}>{m.question}</div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontSize:14,fontWeight:700,color:'#50c050',minWidth:58}}>YES {yp}%</span>
                <div style={{flex:1,height:4,background:'#1a1a1a',borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${yp}%`,background:'linear-gradient(90deg,#50c050,#c8a84b)'}}/>
                </div>
                <span style={{fontSize:14,fontWeight:700,color:'#e05050',minWidth:42,textAlign:'right'}}>{np}%</span>
              </div>
              <div style={{fontSize:10,color:'#666',marginTop:4}}>Vol: {vol}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
