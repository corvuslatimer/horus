import { useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import SignalFeed from './components/SignalFeed'
import MapPanel from './components/MapPanel'
import IncidentsPanel from './components/IncidentsPanel'
import MacroBar from './components/MacroBar'
import ChatPanel from './components/ChatPanel'
import SectorHeatmapPanel from './components/SectorHeatmapPanel'
import TelegramIntelPanel from './components/TelegramIntelPanel'
import useJ7Feed from './hooks/useJ7Feed'
import './App.css'

const LIVE_FEEDS = [
  { name: 'Jerusalem Live', videoId: 'UyduhBUpO7Q' },
  { name: 'Tehran Live', videoId: '-zGuR1qVKrU' },
  { name: 'Tel Aviv Live', videoId: '-VLcYT5QBrY' },
  { name: 'Kyiv Live', videoId: '-Q7FuPINDjA' },
  { name: 'Washington DC Live', videoId: '1wV9lLe14aU' },
  { name: 'Taipei Live', videoId: 'z_fY1pj1VBw' }
]

export default function App() {
  const { signals, feedStatus } = useJ7Feed()

  const [chatPos, setChatPos] = useState({ x: 980, y: 120 })
  const [chatOpen, setChatOpen] = useState(true)
  const [chatSize, setChatSize] = useState({ w: 400, h: 420 })
  const [draggingChat, setDraggingChat] = useState(false)
  const [resizing, setResizing] = useState(null) // 'tl' | 'tr' | 'bl' | 'br' | null
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const resizeStartRef = useRef(null)
  const chatPopupRef = useRef(null)
  const [feedsOpen, setFeedsOpen] = useState(false)
  const [feedsPos, setFeedsPos] = useState({ x: 180, y: 120 })
  const [draggingFeeds, setDraggingFeeds] = useState(false)
  const [feedsDragOffset, setFeedsDragOffset] = useState({ x: 0, y: 0 })

  const MIN_W = 320
  const MIN_H = 220

  const startChatDrag = (e) => {
    if (resizing) return
    setDraggingChat(true)
    setDragOffset({ x: e.clientX - chatPos.x, y: e.clientY - chatPos.y })
  }

  const startFeedsDrag = (e) => {
    setDraggingFeeds(true)
    setFeedsDragOffset({ x: e.clientX - feedsPos.x, y: e.clientY - feedsPos.y })
  }

  const startResize = (corner, e) => {
    e.stopPropagation()
    setResizing(corner)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: chatPos.x,
      posY: chatPos.y,
      w: chatSize.w,
      h: chatSize.h
    }
  }

  const stopInteract = () => {
    setDraggingChat(false)
    setDraggingFeeds(false)
    setResizing(null)
    resizeStartRef.current = null
  }

  const onDrag = (e) => {
    if (draggingChat) {
      const x = Math.max(8, Math.min(window.innerWidth - chatSize.w - 8, e.clientX - dragOffset.x))
      const y = Math.max(56, Math.min(window.innerHeight - chatSize.h - 8, e.clientY - dragOffset.y))
      setChatPos({ x, y })
      return
    }

    if (draggingFeeds) {
      const x = Math.max(20, Math.min(window.innerWidth - 1120, e.clientX - feedsDragOffset.x))
      const y = Math.max(70, Math.min(window.innerHeight - 220, e.clientY - feedsDragOffset.y))
      setFeedsPos({ x, y })
      return
    }

    if (resizing && resizeStartRef.current) {
      const st = resizeStartRef.current
      const dx = e.clientX - st.x
      const dy = e.clientY - st.y

      let nextW = st.w
      let nextH = st.h
      let nextX = st.posX
      let nextY = st.posY

      if (resizing.includes('r')) nextW = st.w + dx
      if (resizing.includes('l')) {
        nextW = st.w - dx
        nextX = st.posX + dx
      }
      if (resizing.includes('b')) nextH = st.h + dy
      if (resizing.includes('t')) {
        nextH = st.h - dy
        nextY = st.posY + dy
      }

      if (nextW < MIN_W) {
        if (resizing.includes('l')) nextX -= (MIN_W - nextW)
        nextW = MIN_W
      }
      if (nextH < MIN_H) {
        if (resizing.includes('t')) nextY -= (MIN_H - nextH)
        nextH = MIN_H
      }

      if (nextX < 8) {
        if (resizing.includes('l')) nextW -= (8 - nextX)
        nextX = 8
      }
      if (nextY < 56) {
        if (resizing.includes('t')) nextH -= (56 - nextY)
        nextY = 56
      }

      const maxW = window.innerWidth - nextX - 8
      const maxH = window.innerHeight - nextY - 8
      nextW = Math.max(MIN_W, Math.min(nextW, maxW))
      nextH = Math.max(MIN_H, Math.min(nextH, maxH))

      setChatPos({ x: nextX, y: nextY })
      setChatSize({ w: nextW, h: nextH })
    }
  }

  useEffect(() => {
    const clampPopup = () => {
      let x = chatPos.x
      let y = chatPos.y
      let w = chatSize.w
      let h = chatSize.h

      const maxW = Math.max(MIN_W, window.innerWidth - 16)
      const maxH = Math.max(MIN_H, window.innerHeight - 64)
      w = Math.min(w, maxW)
      h = Math.min(h, maxH)

      x = Math.max(8, Math.min(window.innerWidth - w - 8, x))
      y = Math.max(56, Math.min(window.innerHeight - h - 8, y))

      if (x !== chatPos.x || y !== chatPos.y) setChatPos({ x, y })
      if (w !== chatSize.w || h !== chatSize.h) setChatSize({ w, h })
    }

    clampPopup()
    window.addEventListener('resize', clampPopup)
    return () => window.removeEventListener('resize', clampPopup)
  }, [chatPos, chatSize])


  return (
    <div className="app" onMouseMove={onDrag} onMouseUp={stopInteract} onMouseLeave={stopInteract}>
      <Header feedStatus={feedStatus} onToggleLiveFeeds={() => setFeedsOpen(v => !v)} />
      <div className="body">
        <div className="left panel">
          <SignalFeed signals={signals} />
          <MacroBar />
          <SectorHeatmapPanel />
        </div>

        <MapPanel signals={signals} />

        <div className="right panel" id="horus-right-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <IncidentsPanel />
          </div>
          <TelegramIntelPanel />
        </div>
      </div>


      {feedsOpen && (
        <div style={{ position: 'fixed', left: feedsPos.x, top: feedsPos.y, width: 1120, zIndex: 9998, boxShadow: '0 10px 35px rgba(0,0,0,.55)', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2a2a', background: '#0d0d0d' }}>
          <div onMouseDown={startFeedsDrag} style={{ cursor: 'move', userSelect: 'none', background: '#111', borderBottom: '1px solid #2a2a2a', color: '#bbb', fontSize: 11, letterSpacing: 1, padding: '7px 10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>LIVE YOUTUBE FEEDS</span>
            <button onClick={() => setFeedsOpen(false)} style={{ background:'#1a1a1a', border:'1px solid #333', color:'#bbb', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>Close</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8, padding:8 }}>
            {LIVE_FEEDS.map(f => (
              <div key={f.videoId} style={{ border:'1px solid #252525', borderRadius:8, overflow:'hidden', background:'#111' }}>
                <div style={{ padding:'6px 8px', fontSize:11, color:'#cfcfcf', borderBottom:'1px solid #252525' }}>{f.name}</div>
                <iframe
                  title={f.name}
                  src={`https://www.youtube.com/embed/${f.videoId}?autoplay=1&controls=1&mute=1&playsinline=1&modestbranding=1&rel=0`}
                  style={{ width:'100%', aspectRatio:'16 / 8.2', border:0 }}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={chatPopupRef}
        style={{
          position: 'fixed',
          left: chatPos.x,
          top: chatPos.y,
          width: chatSize.w,
          height: chatSize.h,
          minWidth: MIN_W,
          minHeight: MIN_H,
          zIndex: 9999,
          boxShadow: '0 10px 35px rgba(0,0,0,.55)',
          borderRadius: 8,
          overflow: 'auto',
          resize: 'both',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          onMouseDown={startChatDrag}
          style={{ cursor: draggingChat ? 'grabbing' : 'move', userSelect: 'none', background: '#111', border: '1px solid #2a2a2a', borderBottom: 'none', color: '#bbb', fontSize: 11, letterSpacing: 1, padding: '7px 10px' }}
        >
          AGENT CHAT POPUP
        </div>
        <div style={{ border: '1px solid #2a2a2a', borderTop: 'none', flex: 1, minHeight: 0 }}>
          <ChatPanel hideHeader fill />
        </div>

      </div>
    </div>
  )
}
