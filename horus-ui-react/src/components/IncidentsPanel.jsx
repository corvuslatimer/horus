import { useState, useEffect } from 'react'

const GDELT_URL = 'https://api.gdeltproject.org/api/v2/doc/doc?query=(war%20OR%20conflict%20OR%20attack%20OR%20strike%20OR%20military)&mode=artlist&format=json&timespan=6h&maxrecords=50&sort=datedesc'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  let d
  const s = String(dateStr).replace(/[^0-9T:Z\-]/g,'').trim()
  if (/^\d{14}$/.test(s)) {
    d = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}Z`)
  } else {
    d = new Date(dateStr)
  }
  if (isNaN(d)) return ''
  const diff = Math.floor((Date.now() - d) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`
  return `${Math.floor(diff/1440)}d ago`
}

export default function IncidentsPanel() {
  const [articles, setArticles] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(GDELT_URL)
        const j = await r.json()
        setArticles(j?.articles || [])
        setStatus('live')
      } catch {
        setStatus('error')
      }
    }
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
      <div style={{padding:'9px 14px',fontSize:10,letterSpacing:2,color:'#888',textTransform:'uppercase',borderBottom:'1px solid #1a1a1a',display:'flex',justifyContent:'space-between',flexShrink:0}}>
        <span>CURRENT INCIDENTS</span>
        <span style={{color: status==='live'?'#c8a84b':'#555'}}>{status==='live'?`${articles.length} articles`:status}</span>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {articles.length === 0 && <div style={{padding:30,color:'#444',fontSize:11,textAlign:'center'}}>LOADING INCIDENTS…</div>}
        {articles.map((a, i) => (
          <div key={i}
            onClick={() => a.url && window.open(a.url,'_blank','noopener')}
            style={{padding:'10px 14px',borderBottom:'1px solid #111',cursor:'pointer',transition:'background .1s'}}
            onMouseEnter={e=>e.currentTarget.style.background='#111'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:4}}>
              <span style={{fontSize:9,padding:'2px 6px',borderRadius:2,fontWeight:700,background:'#2a1a1a',color:'#e05050',textTransform:'uppercase',flexShrink:0}}>
                {a.sourcecountry || 'GLOBAL'}
              </span>
              <span style={{fontSize:10,color:'#555',marginLeft:'auto',flexShrink:0,whiteSpace:'nowrap'}}>{timeAgo(a.seendate)}</span>
            </div>
            <div style={{fontSize:11,color:'#ddd',fontWeight:500,lineHeight:1.45,marginBottom:3}}>{a.title}</div>
            <div style={{fontSize:10,color:'#666'}}>{a.domain}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
