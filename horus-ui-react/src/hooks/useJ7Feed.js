import { useState, useEffect, useRef } from 'react'

const MAX = 200

// TODO: replace with Horus native signal feed
// J7 integration removed — credentials stripped before open-source publish

export default function useJ7Feed() {
  const [signals, setSignals] = useState([])
  const [usersOnline, setUsersOnline] = useState(null)
  const [feedStatus, setFeedStatus] = useState('pending')

  // Feed stub — wire your own signal source here
  // Expected shape per signal: { type, author, text, url, time, id }

  return { signals, usersOnline, feedStatus }
}
