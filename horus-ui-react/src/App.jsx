import { useState } from 'react'
import Header from './components/Header'
import SignalFeed from './components/SignalFeed'
import MapPanel from './components/MapPanel'
import IncidentsPanel from './components/IncidentsPanel'
import MacroBar from './components/MacroBar'
import ChatPanel from './components/ChatPanel'
import useJ7Feed from './hooks/useJ7Feed'
import './App.css'

export default function App() {
  const { signals, feedStatus } = useJ7Feed()
  const [chatHeight, setChatHeight] = useState(338)
  const [dragging, setDragging] = useState(false)

  const startDrag = () => setDragging(true)
  const stopDrag = () => setDragging(false)
  const onDrag = (e) => {
    if (!dragging) return
    const panel = document.getElementById('horus-right-panel')
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const fromBottom = rect.bottom - e.clientY
    const clamped = Math.max(140, Math.min(fromBottom, rect.height * 0.75))
    setChatHeight(Math.round(clamped))
  }

  return (
    <div className="app" onMouseMove={onDrag} onMouseUp={stopDrag} onMouseLeave={stopDrag}>
      <Header feedStatus={feedStatus} />
      <div className="body">
        <div className="left panel">
          <SignalFeed signals={signals} />
          <MacroBar />
        </div>
        <MapPanel signals={signals} />
        <div className="right panel" id="horus-right-panel" style={{display:'flex',flexDirection:'column',minHeight:0}}>
          <div style={{flex:1,minHeight:0,overflow:'hidden'}}>
            <IncidentsPanel />
          </div>
          <div
            onMouseDown={startDrag}
            title="Drag to resize chat"
            style={{height:8,cursor:'row-resize',background:'linear-gradient(to bottom, #1a1a1a, #2a2a2a)',borderTop:'1px solid #2c2c2c',borderBottom:'1px solid #111',flexShrink:0}}
          />
          <ChatPanel heightPx={chatHeight} />
        </div>
      </div>
    </div>
  )
}
