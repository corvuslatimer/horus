import { useState, useEffect, useRef } from 'react'

const RELAY = import.meta.env.VITE_RELAY_URL || 'http://100.83.149.17:8787'

function parseSeenDate(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr)
  if (/^\d{14}$/.test(s)) {
    const d = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}Z`)
    return Number.isNaN(d.getTime()) ? null : d.getTime()
  }
  const d = new Date(dateStr)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function timeAgo(article, nowMs) {
  const ts = article?.ingestedTs || parseSeenDate(article?.seendate)
  if (!ts) return ''
  const diff = Math.max(0, Math.floor((nowMs - ts) / 1000))
  if (diff < 2) return 'just now'
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function IncidentsPanel() {
  const [articles, setArticles] = useState([])
  const [status, setStatus] = useState('loading')
  const [flash, setFlash] = useState(false)
  const [newIds, setNewIds] = useState(new Set())
  const [nowMs, setNowMs] = useState(Date.now())
  const seenRef = useRef(new Set())
  const primedRef = useRef(false)

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${RELAY}/api/incidents`)
        const j = await r.json()
        const next = (j?.articles || []).filter(a => String(a.source || '').toLowerCase() !== 'financialjuice')

        const keys = next.map(a => a.url || `${a.title}|${a.seendate}`)
        if (!primedRef.current) {
          keys.forEach(k => seenRef.current.add(k))
          primedRef.current = true
        } else {
          const fresh = keys.filter(k => !seenRef.current.has(k))
          if (fresh.length > 0) {
            fresh.forEach(k => seenRef.current.add(k))
            setNewIds(new Set(fresh))
            setFlash(true)
            setTimeout(() => { setFlash(false); setNewIds(new Set()) }, 2200)
            try {
              const Ctx = window.AudioContext || window.webkitAudioContext
              const ctx = new Ctx()
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.type = 'sawtooth'
              osc.frequency.setValueAtTime(880, ctx.currentTime)
              osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18)
              gain.gain.setValueAtTime(0.0001, ctx.currentTime)
              gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02)
              gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22)
              osc.connect(gain).connect(ctx.destination)
              osc.start()
              osc.stop(ctx.currentTime + 0.23)
            } catch {}
          }
        }

        setArticles(next)
        setStatus('live')
      } catch { setStatus('error') }
    }
    load(); const id = setInterval(load, 2000); return () => clearInterval(id)
  }, [])

  const sortedArticles = [...articles].sort((a,b) => {
    const ta = (a?.ingestedTs || parseSeenDate(a?.seendate) || 0)
    const tb = (b?.ingestedTs || parseSeenDate(b?.seendate) || 0)
    return tb - ta
  })

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
      <div style={{padding:'9px 14px',fontSize:10,letterSpacing:2,color:'#888',textTransform:'uppercase',borderBottom:'1px solid #1a1a1a',display:'flex',flexShrink:0,background: flash ? 'rgba(239,68,68,0.20)' : 'transparent',boxShadow: flash ? 'inset 0 0 0 1px rgba(239,68,68,0.6)' : 'none',transition:'all .25s ease'}}>
        <span>CURRENT INCIDENTS</span>
      </div>
      <div style={{flex:1,overflowY:'scroll',scrollbarWidth:'thin'}}>
        {sortedArticles.length===0 && <div style={{padding:30,color:'#444',fontSize:11,textAlign:'center'}}>LOADING INCIDENTS…</div>}
        {sortedArticles.map((a,i) => {
          const itemKey = a.url || `${a.title}|${a.seendate}`
          const isNew = newIds.has(itemKey)
          return (
          <div key={itemKey} onClick={()=>a.url&&window.open(a.url,'_blank','noopener')}
            style={{padding:'10px 14px',borderBottom:'1px solid #111',cursor:'pointer',background:isNew?'rgba(239,68,68,0.18)':'transparent',boxShadow:isNew?'inset 0 0 0 1px rgba(239,68,68,0.65)':'none',transition:'all .2s ease'}}
            onMouseEnter={e=>e.currentTarget.style.background='#111'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:4}}>
              <span style={{fontSize:9,padding:'2px 6px',borderRadius:2,fontWeight:700,background:'#2a1a1a',color:'#e05050',textTransform:'uppercase',flexShrink:0}}>{a.sourcecountry||'GLOBAL'}</span>
              <span style={{fontSize:10,color:'#555',marginLeft:'auto',flexShrink:0}}>{timeAgo(a, nowMs)}</span>
            </div>
            <div style={{fontSize:11,color:'#ddd',fontWeight:500,lineHeight:1.45,marginBottom:3}}>{a.title}</div>
            <div style={{fontSize:10,color:'#666'}}>{a.domain}</div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
