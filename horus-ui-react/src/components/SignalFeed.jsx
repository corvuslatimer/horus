const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

export default function SignalFeed({ signals }) {
  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
      <div style={{padding:'9px 14px',fontSize:10,letterSpacing:2,color:'#888',textTransform:'uppercase',borderBottom:'1px solid #1a1a1a',display:'flex',justifyContent:'space-between',flexShrink:0}}>
        <span>LIVE SIGNAL FEED</span>
        <span style={{color:'#c8a84b'}}>{signals.length} signals</span>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {signals.length === 0 && <div style={{padding:30,color:'#444',fontSize:11,textAlign:'center'}}>INITIALIZING FEED…</div>}
        {[...signals].reverse().map((s,i) => (
          <div key={i}
            onClick={() => s.url && window.open(s.url,'_blank','noopener')}
            style={{padding:'9px 14px',borderBottom:'1px solid #111',cursor:s.url?'pointer':'default',transition:'background .1s'}}
            onMouseEnter={e=>e.currentTarget.style.background='#111'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:4}}>
              <span style={{fontSize:9,padding:'2px 6px',borderRadius:2,fontWeight:700,background:s.type==='tweet'?'#1a2a3a':'#2a1a1a',color:s.type==='tweet'?'#4a9eda':'#e05050'}}>{s.type}</span>
              <span style={{fontSize:11,color:'#bbb',fontWeight:600}}>{s.author}</span>
              <span style={{marginLeft:'auto',fontSize:10,color:'#555'}}>{s.time}</span>
            </div>
            <div style={{fontSize:11,color:'#ddd',lineHeight:1.45}}>{s.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
