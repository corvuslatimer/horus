import { useState, useEffect } from 'react'

export default function Header({ feedStatus }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setTime([n.getUTCHours(),n.getUTCMinutes(),n.getUTCSeconds()].map(x=>String(x).padStart(2,'0')).join(':') + ' UTC')
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  return (
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 20px',borderBottom:'1px solid #1e1e1e',background:'#0d0d0d',flexShrink:0}}>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <svg viewBox="0 0 48 28" width="36" height="21" fill="none">
          <path d="M24 4C13 4 4 14 4 14s9 10 20 10 20-10 20-10S35 4 24 4z" stroke="#c8a84b" strokeWidth="2"/>
          <circle cx="24" cy="14" r="5" fill="#c8a84b"/>
          <circle cx="24" cy="14" r="2.2" fill="#0a0a0a"/>
          <line x1="24" y1="19" x2="22" y2="26" stroke="#c8a84b" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{fontWeight:700,letterSpacing:5,color:'#c8a84b',fontSize:20}}>HORUS</span>
      </div>
      <div style={{display:'flex',gap:20,fontSize:11,color:'#888'}}>
        <StatusItem label="FEED" status={feedStatus} />

        <span>{time}</span>
      </div>
    </header>
  )
}

function StatusItem({ label, status }) {
  const color = status === 'live' ? '#4caf50' : status === 'connecting' ? '#f0a500' : '#555'
  const shadow = status === 'live' ? '0 0 6px #4caf50' : status === 'connecting' ? '0 0 6px #f0a500' : 'none'
  return (
    <div style={{display:'flex',gap:6,alignItems:'center'}}>
      <div style={{width:6,height:6,borderRadius:'50%',background:color,boxShadow:shadow}}/>
      <span>{status === 'live' ? 'LIVE' : status === 'connecting' ? 'CONNECTING' : label}</span>
    </div>
  )
}
