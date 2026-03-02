import { useEffect, useState, useRef } from 'react'

function timeAgoFromSignal(sig, nowMs) {
  const ts = sig?.ts || (sig?.iso ? Date.parse(sig.iso) : null)
  if (!ts || Number.isNaN(ts)) return sig?.time || ''
  const diff = Math.max(0, Math.floor((nowMs - ts) / 1000))
  if (diff < 2) return 'just now'
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function SignalFeed({ signals }) {
  const [nowMs, setNowMs] = useState(0)
  const [flashIds, setFlashIds] = useState(new Set())
  const seenRef = useRef(new Set())

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const incomingFast = []
    for (const s of signals) {
      if (!seenRef.current.has(s.id)) {
        seenRef.current.add(s.id)
        if (s.fastAlert) incomingFast.push(s.id)
      }
    }
    if (incomingFast.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFlashIds(prev => {
        const n = new Set(prev)
        incomingFast.forEach(id => n.add(id))
        return n
      })
      setTimeout(() => {
        setFlashIds(prev => {
          const n = new Set(prev)
          incomingFast.forEach(id => n.delete(id))
          return n
        })
      }, 2400)

      // alert ping
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        const ctx = new Ctx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(960, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.2)
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22)
        osc.connect(gain).connect(ctx.destination)
        osc.start(); osc.stop(ctx.currentTime + 0.23)
      } catch (err) { console.debug(err) }
    }
  }, [signals])

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflowX:'hidden'}}>
      <div style={{padding:'9px 14px',fontSize:10,letterSpacing:2,color:'#888',textTransform:'uppercase',borderBottom:'1px solid #1a1a1a',display:'flex',flexShrink:0}}>
        <span>LIVE SIGNAL FEED</span>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {signals.length === 0 && <div style={{padding:30,color:'#444',fontSize:11,textAlign:'center'}}>INITIALIZING FEED…</div>}
        {signals.map((s,i) => {
          const isFlash = flashIds.has(s.id)
          const isFast = s.fastAlert || s.source === 'jpost' || s.source === 'financialjuice'
          return (
          <div key={s.id || `${s.author}-${i}`}
            onClick={() => s.url && window.open(s.url,'_blank','noopener')}
            style={{
              padding:'9px 14px',
              borderBottom:'1px solid #111',
              maxWidth:'100%',
              cursor:s.url?'pointer':'default',
              transition:'all .15s ease',
              background: isFlash ? 'rgba(239,68,68,0.22)' : 'transparent',
              boxShadow: isFlash ? 'inset 0 0 0 1px rgba(239,68,68,0.75)' : 'none'
            }}
            onMouseEnter={e=>e.currentTarget.style.background = isFlash ? 'rgba(239,68,68,0.28)' : '#111'}
            onMouseLeave={e=>e.currentTarget.style.background = isFlash ? 'rgba(239,68,68,0.22)' : 'transparent'}
          >
            <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:4}}>
              <span style={{
                fontSize:9,padding:'2px 6px',borderRadius:2,fontWeight:700,
                background:isFast ? '#3a1111' : (s.type==='tweet'?'#1a2a3a':'#2a1a1a'),
                color:isFast ? '#ff6b6b' : (s.type==='tweet'?'#4a9eda':'#e05050')
              }}>{isFast ? (String(s.author || '').toUpperCase()) : s.type}</span>
              <span style={{fontSize:11,color:'#bbb',fontWeight:600}}>{s.author}</span>
              <span style={{marginLeft:'auto',fontSize:10,color:'#555'}}>{timeAgoFromSignal(s, nowMs)}</span>
            </div>
            <div style={{fontSize:11,color:'#ddd',lineHeight:1.45,whiteSpace:'normal',wordBreak:'break-word',overflowWrap:'anywhere'}}>{s.text}</div>
          </div>
        )})}
      </div>
    </div>
  )
}
