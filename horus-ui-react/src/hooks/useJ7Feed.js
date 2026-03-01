import { useState, useEffect, useRef } from 'react'

const MAX = 200
const J7_TOKEN = import.meta.env.VITE_J7_TOKEN || ''

export default function useJ7Feed() {
  const [signals, setSignals] = useState([])
  const [usersOnline, setUsersOnline] = useState(null)
  const [feedStatus, setFeedStatus] = useState(J7_TOKEN ? 'connecting' : 'pending')
  const wsRef = useRef(null)

  const ts = () => {
    const n = new Date()
    return [n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds()].map(x => String(x).padStart(2, '0')).join(':')
  }

  useEffect(() => {
    if (!J7_TOKEN) return
    const connect = () => {
      const ws = new WebSocket('wss://j7tracker.io/socket.io/?EIO=4&transport=websocket')
      wsRef.current = ws
      ws.onopen = () => {
        ws.send('40')
        setTimeout(() => ws.send(`42["user_connected","${J7_TOKEN}"]`), 500)
        setFeedStatus('live')
      }
      ws.onmessage = (e) => {
        const raw = e.data
        if (raw === '2') { ws.send('3'); return }
        if (!raw.startsWith('42[')) return
        try {
          const p = JSON.parse(raw.slice(2))
          if (p[0] === 'tweet' && p[1]?.text?.length > 5) {
            const id = p[1].id || p[1].tweetId || null
            const sig = {
              type: 'tweet',
              author: p[1].author ? `@${p[1].author.handle}` : 'unknown',
              text: p[1].text,
              url: p[1].tweetUrl || null,
              time: ts(),
              id
            }
            setSignals(prev => {
              if (id && prev.some(s => s.id === id)) return prev
              if (prev.some(s => s.author === sig.author && s.text === sig.text)) return prev
              return [sig, ...prev].slice(0, MAX)
            })
          }
          if (p[0] === 'connected_users' && Array.isArray(p[1])) setUsersOnline(p[1].length)
        } catch {}
      }
      ws.onclose = () => { setFeedStatus('connecting'); setTimeout(connect, 3000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => wsRef.current?.close()
  }, [])

  return { signals, usersOnline, feedStatus }
}
