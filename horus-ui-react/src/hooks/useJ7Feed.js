import { useState, useEffect, useRef } from 'react'

const MAX = 200

// TODO: replace with your own signal feed source
// Configure via environment variable or relay endpoint
// Expected signal shape: { type, author, text, url, time, id }

export default function useJ7Feed() {
  const [signals, setSignals] = useState([])
  const [usersOnline, setUsersOnline] = useState(null)
  const [feedStatus, setFeedStatus] = useState('pending')

  // Wire your signal source here
  // Example: WebSocket, SSE, or polling from relay /api/signals

  return { signals, usersOnline, feedStatus }
}
