import { useState, useEffect } from 'react'

const RELAY = import.meta.env.VITE_RELAY_URL || 'http://localhost:8787'

export default function useJ7Feed() {
  const [signals, setSignals] = useState([])
  const [feedStatus, setFeedStatus] = useState('connecting')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const r = await fetch(`${RELAY}/api/signals`)
        const j = await r.json()
        if (!active) return
        setSignals(Array.isArray(j?.signals) ? j.signals : [])
        setFeedStatus('live')
      } catch {
        if (!active) return
        setFeedStatus('connecting')
      }
    }

    load()
    const id = setInterval(load, 2000)
    return () => { active = false; clearInterval(id) }
  }, [])

  return { signals, feedStatus }
}
