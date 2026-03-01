import { useState, useEffect, useRef } from 'react'
const RELAY = import.meta.env.VITE_RELAY_URL || 'http://100.83.149.17:8787'


export default function ChatPanel() {
  
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const logRef = useRef(null)
  useEffect(() => { fetch(`${RELAY}/api/chat`).then(r=>r.json()).then(j=>setMessages((j.messages||[]).slice(-20))).catch(()=>{}) }, [])
  useEffect(() => { if(logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight }, [messages])
  const send = async (e) => {
    e.preventDefault(); const msg=input.trim(); if(!msg) return
    setInput(''); setMessages(prev=>[...prev,{role:'user',text:msg}])
    try {
      const r = await fetch(`${RELAY}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})})
      const j = await r.json()
      if(j?.reply?.text) setMessages(prev=>[...prev,j.reply])
    } catch { setMessages(prev=>[...prev,{role:'assistant',text:'Relay unavailable.'}]) }
  }
  return (
    <>
      <style>{`.chat-log::-webkit-scrollbar{display:none;}`}</style>
    <div style={{flex:'0 0 260px',display:'flex',flexDirection:'column',borderTop:'1px solid #1a1a1a',background:'#0b0b0b',minHeight:0}}>
      <div style={{padding:'8px 10px',fontSize:10,letterSpacing:2,color:'#888',borderBottom:'1px solid #1a1a1a',flexShrink:0}}>AGENT CHAT</div>
      <div ref={logRef} style={{flex:1,overflowY:'auto',scrollbarWidth:'none',msOverflowStyle:'none',padding:'8px 10px',display:'flex',flexDirection:'column',gap:6}} className="chat-log">
        {messages.map((m,i)=>(
          <div key={i} style={{fontSize:11,lineHeight:1.35,padding:'6px 8px',borderRadius:6,maxWidth:'95%',alignSelf:m.role==='user'?'flex-end':'flex-start',background:m.role==='user'?'#1b2a3d':'#1b1b1b',color:m.role==='user'?'#dbeafe':'#ddd',border:m.role==='assistant'?'1px solid #2a2a2a':'none'}}>{m.text}</div>
        ))}
      </div>
      <form onSubmit={send} style={{display:'flex',gap:6,padding:8,borderTop:'1px solid #1a1a1a',flexShrink:0}}>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask your agent..." style={{flex:1,background:'#111',border:'1px solid #2a2a2a',color:'#ddd',fontSize:12,padding:'7px 8px',borderRadius:6,outline:'none'}}/>
        <button type="submit" style={{background:'#1f3a5a',border:'1px solid #355170',color:'#cfe8ff',padding:'7px 10px',borderRadius:6,fontSize:12,cursor:'pointer'}}>Send</button>
      </form>
    </div>
    </>
  )
}
