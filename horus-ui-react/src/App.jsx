import { useState, useEffect } from 'react'
import Header from './components/Header'
import SignalFeed from './components/SignalFeed'
import MapPanel from './components/MapPanel'
import IncidentsPanel from './components/IncidentsPanel'
import MacroBar from './components/MacroBar'
import ChatPanel from './components/ChatPanel'
import useJ7Feed from './hooks/useJ7Feed'
import './App.css'

export default function App() {
  const { signals, usersOnline, feedStatus } = useJ7Feed()

  return (
    <div className="app">
      <Header feedStatus={feedStatus} />
      <div className="body">
        <div className="left panel">
          <SignalFeed signals={signals} />
          <MacroBar />
        </div>
        <MapPanel signals={signals} />
        <div className="right panel">
          <IncidentsPanel />
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
