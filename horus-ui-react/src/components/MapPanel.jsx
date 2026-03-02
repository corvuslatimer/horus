import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const HOTSPOTS = [
  {name:'Iran',lat:35.7,lng:51.4,severity:1.0,risk:'HIGH',note:'Leadership instability / strike risk', region:'Middle East', trigger:'Strategic strikes / command instability'},
  {name:'Israel / Gaza',lat:31.5,lng:34.5,severity:0.95,risk:'HIGH',note:'Active conflict zone', region:'Levant', trigger:'Ongoing kinetic conflict'},
  {name:'Strait of Hormuz',lat:26.5,lng:56.5,severity:0.88,risk:'HIGH',note:'Energy chokepoint risk', region:'Gulf', trigger:'Shipping disruption potential'},
  {name:'Lebanon',lat:33.9,lng:35.8,severity:0.76,risk:'ELEVATED',note:'Border escalation risk', region:'Levant', trigger:'Cross-border escalation'},
  {name:'Red Sea / Yemen',lat:15.0,lng:42.0,severity:0.74,risk:'ELEVATED',note:'Shipping disruption risk', region:'Red Sea', trigger:'Transit route pressure'},
  {name:'Ukraine',lat:49,lng:32,severity:0.85,risk:'HIGH',note:'Ongoing war theater', region:'Eastern Europe', trigger:'Sustained war operations'},
  {name:'Taiwan Strait',lat:24.2,lng:121.0,severity:0.62,risk:'WATCH',note:'Strategic tension zone', region:'East Asia', trigger:'Military signaling / drills'},
  {name:'Kuwait',lat:29.3,lng:47.9,severity:0.65,risk:'ELEVATED',note:'Regional strike spillover', region:'Gulf', trigger:'Regional retaliation spillover'}
]

const PRESETS = {
  GLOBAL: { label: 'Global', center: [25, 38], zoom: 2, scopeKm: 20000 },
  GULF: { label: 'Gulf', center: [26.5, 50.5], zoom: 5, scopeKm: 950 },
  LEVANT: { label: 'Levant', center: [33.2, 36.0], zoom: 6, scopeKm: 700 },
  EUROPE: { label: 'Europe', center: [50.0, 14.0], zoom: 4, scopeKm: 1800 }
}

const TIME_WINDOWS = {
  '1H': { label: '1h', minutes: 60 },
  '6H': { label: '6h', minutes: 360 },
  '24H': { label: '24h', minutes: 1440 },
  '7D': { label: '7d', minutes: 10080 }
}

const STORAGE_KEY = 'horus.map.controls.v1'


const CHOKEPOINTS = [
  { name: 'Strait of Hormuz', lat: 26.5, lng: 56.4 },
  { name: 'Suez Canal', lat: 30.8, lng: 32.3 },
  { name: 'Bab el-Mandeb', lat: 12.7, lng: 43.3 },
  { name: 'Malacca Strait', lat: 2.4, lng: 101.0 },
  { name: 'Turkish Straits', lat: 41.1, lng: 29.0 },
  { name: 'Panama Canal', lat: 9.1, lng: -79.7 },
  { name: 'Gibraltar Strait', lat: 36.0, lng: -5.6 },
  { name: 'English Channel', lat: 50.0, lng: -1.0 },
  { name: 'Dover Strait', lat: 51.0, lng: 1.5 },
  { name: 'Bosphorus', lat: 41.1, lng: 29.0 },
  { name: 'Dardanelles', lat: 40.2, lng: 26.4 },
  { name: 'Taiwan Strait', lat: 24.0, lng: 119.8 },
  { name: 'Luzon Strait', lat: 20.0, lng: 121.0 },
  { name: 'Korea Strait', lat: 34.3, lng: 129.2 },
  { name: 'Tsushima Strait', lat: 34.7, lng: 129.6 },
  { name: 'Bering Strait', lat: 66.0, lng: -169.0 },
  { name: 'Danish Straits', lat: 55.5, lng: 12.7 },
  { name: 'Mozambique Channel', lat: -18.0, lng: 42.0 }
]

const TRADE_ROUTES = [
  { name: 'Gulf → Europe Energy', points: [[26.5, 56.4], [14.5, 52.0], [30.8, 32.3], [35.0, 14.0]] },
  { name: 'Gulf → Asia Energy', points: [[26.5, 56.4], [12.7, 43.3], [2.4, 101.0], [22.3, 114.1]] },
  { name: 'Red Sea → Mediterranean', points: [[12.7, 43.3], [20.0, 38.0], [30.8, 32.3]] },
  { name: 'Atlantic Container Corridor', points: [[51.5, -0.1], [48.9, 2.4], [40.7, -74.0], [25.8, -80.2]] },
  { name: 'Asia Pacific Trunk', points: [[35.7, 139.7], [31.2, 121.5], [22.3, 114.1], [1.3, 103.8]] },
  { name: 'Indian Ocean Arc', points: [[25.3, 55.3], [19.0, 72.8], [6.9, 79.8], [1.3, 103.8]] },
  { name: 'South Atlantic Energy', points: [[-22.9, -43.2], [-33.9, 18.4], [36.0, -5.6], [51.5, -0.1]] },
  { name: 'Transpacific Container', points: [[35.7, 139.7], [37.5, 126.9], [34.0, -118.2], [47.6, -122.3]] }
]

const BASES = [
  { name: 'Al Udeid Air Base', lat: 25.117, lng: 51.315 },
  { name: 'NSA Bahrain', lat: 26.215, lng: 50.579 },
  { name: 'Incirlik Air Base', lat: 37.003, lng: 35.425 },
  { name: 'RAF Akrotiri', lat: 34.59, lng: 32.99 },
  { name: 'Camp Arifjan', lat: 28.86, lng: 47.93 },
  { name: 'Ramstein Air Base', lat: 49.44, lng: 7.60 },
  { name: 'Rota Naval Base', lat: 36.64, lng: -6.35 },
  { name: 'Diego Garcia', lat: -7.31, lng: 72.41 },
  { name: 'Yokosuka Naval Base', lat: 35.28, lng: 139.67 },
  { name: 'Guam Andersen AFB', lat: 13.58, lng: 144.93 },
  { name: 'Camp Lemonnier', lat: 11.55, lng: 43.15 },
  { name: 'Souda Bay', lat: 35.53, lng: 24.15 },
  { name: 'Al Dhafra Air Base', lat: 24.24, lng: 54.55 },
  { name: 'Sigonella NAS', lat: 37.40, lng: 14.92 }
]


const CABLES = [
  { name: 'SEA-ME-WE Corridor', points: [[31.2, 29.9], [13.4, 43.2], [7.0, 79.8], [1.3, 103.8]] },
  { name: 'Europe-Middle East Link', points: [[41.0, 28.9], [35.7, 34.8], [31.2, 29.9]] },
  { name: 'Transatlantic Trunk', points: [[51.5, -8.0], [45.0, -30.0], [40.7, -74.0]] },
  { name: 'North Atlantic Ring', points: [[53.3, -6.2], [64.1, -21.9], [47.6, -52.7], [40.7, -74.0]] },
  { name: 'Pacific Fiber Arc', points: [[35.7, 139.7], [21.3, -157.8], [34.0, -118.2]] },
  { name: 'Southeast Asia Mesh', points: [[1.3, 103.8], [13.7, 100.5], [14.6, 121.0], [22.3, 114.1]] },
  { name: 'Africa East Coast Cable', points: [[-26.2, 28.0], [-1.3, 36.8], [11.6, 43.1], [25.2, 55.3]] }
]

const PIPELINES = [
  { name: 'SUMED Pipeline', points: [[30.8, 32.3], [29.95, 32.55], [30.0, 31.2]] },
  { name: 'East-West Petroline', points: [[25.0, 49.6], [24.1, 42.6], [20.6, 39.1]] },
  { name: 'BTC Pipeline', points: [[40.4, 49.9], [41.6, 44.8], [39.9, 32.8], [38.4, 27.1]] },
  { name: 'Nord Stream Corridor', points: [[59.9, 30.3], [55.5, 15.0], [54.3, 13.1]] },
  { name: 'Druzhba Mainline', points: [[55.8, 37.6], [53.9, 27.6], [52.2, 21.0], [50.1, 14.4]] },
  { name: 'Trans-Anatolian (TANAP)', points: [[39.9, 44.8], [39.0, 35.0], [41.0, 27.9]] },
  { name: 'Keystone Corridor', points: [[53.5, -113.5], [47.6, -101.0], [29.7, -95.4]] },
  { name: 'China-Myanmar', points: [[24.9, 97.7], [25.0, 102.7], [22.0, 99.5]] }
]

const CONFLICT_ZONES = [
  { name: 'Donbas', lat: 48.0, lng: 37.8, radiusKm: 130 },
  { name: 'Gaza Envelope', lat: 31.45, lng: 34.4, radiusKm: 45 },
  { name: 'Red Sea Flashpoint', lat: 14.5, lng: 42.6, radiusKm: 120 },
  { name: 'Sahel Instability Belt', lat: 16.5, lng: -1.0, radiusKm: 320 },
  { name: 'Sudan Conflict Zone', lat: 15.5, lng: 32.5, radiusKm: 180 },
  { name: 'Syria-Iraq Frontier', lat: 35.0, lng: 40.5, radiusKm: 140 },
  { name: 'Kashmir Tension Arc', lat: 34.3, lng: 74.7, radiusKm: 120 },
  { name: 'South China Sea Tension', lat: 12.0, lng: 114.0, radiusKm: 300 },
  { name: 'Horn of Africa Flashpoint', lat: 8.0, lng: 45.0, radiusKm: 220 },
  { name: 'Myanmar Border Conflict', lat: 21.5, lng: 97.5, radiusKm: 140 }
]

const LIVE_FEEDS = [
  { name: 'Al Jazeera English', channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
  { name: 'TRT World', channelId: 'UC7fWeaHhqgM4Ry-RMpM2YYw' },
  { name: 'France 24 English', channelId: 'UCCCPCZNChQdGa9EkATeye4g' }
]




const GEO_EVENTS = [
  { id:'evt-001', title:'US-Israel joint strikes on Iran; Supreme Leader Khamenei killed', category:'strike', severity:95, lat:35.6892, lng:51.3890, source:'Reuters/Al Jazeera reports (multiple sources March 1-2 2026)', ts:'2026-02-28T00:00:00Z' },
  { id:'evt-002', title:'Iran retaliatory missile barrages on Israel', category:'strike', severity:90, lat:32.0853, lng:34.7818, source:'AP/Guardian reports (March 1 2026)', ts:'2026-03-01T00:00:00Z' },
  { id:'evt-003', title:'Hezbollah launches rockets/drones at northern Israel in retaliation', category:'strike', severity:85, lat:33.0, lng:35.5, source:'Haaretz/Guardian (March 1 2026)', ts:'2026-03-01T12:00:00Z' },
  { id:'evt-004', title:'IDF strikes Hezbollah targets in Beirut and southern Lebanon', category:'strike', severity:80, lat:33.8938, lng:35.5018, source:'Reuters/Haaretz (March 1 2026)', ts:'2026-03-01T18:00:00Z' },
  { id:'evt-005', title:'Iran declares 40 days mourning; threatens most intense attack', category:'diplomatic', severity:75, lat:35.6892, lng:51.3890, source:'Al Jazeera (Feb 28-March 1 2026)', ts:'2026-03-01T00:00:00Z' }
]

const SHIPPING_INCIDENTS = [
  { id:'ship-001', title:'Attacks on vessels in Strait of Hormuz; shipping disruptions', lat:26.5667, lng:56.4333, status:'disrupted', route:'Strait of Hormuz / Persian Gulf', ts:'2026-03-01T00:00:00Z' },
  { id:'ship-002', title:'Maersk halts some Red Sea transits amid fears of Houthi resumption', lat:15.0, lng:40.0, status:'disrupted', route:'Red Sea', ts:'2026-03-01T12:00:00Z' },
  { id:'ship-003', title:'Houthis signal intent to resume Red Sea attacks post-Iran strikes', lat:14.7978, lng:42.9511, status:'disrupted', route:'Red Sea / Gulf of Aden', ts:'2026-03-01T00:00:00Z' }
]

const INFRA_OUTAGES = [
  { id:'infra-001', name:'Middle East airspace closures / flight halts (multiple airports)', infraType:'airport', lat:35.6892, lng:51.3890, impact:'high', ts:'2026-03-01T00:00:00Z' }
]

const COUNTRY_SCORES = [
  { country:'Israel', iso2:'IL', riskScore:92, trend:'rising', updatedAt:'2026-03-02T00:00:00Z' },
  { country:'Iran', iso2:'IR', riskScore:95, trend:'rising', updatedAt:'2026-03-02T00:00:00Z' },
  { country:'Lebanon', iso2:'LB', riskScore:85, trend:'rising', updatedAt:'2026-03-01T20:00:00Z' }
]

const norm = c => (c || '').trim().toUpperCase()
const trackHistory = {}
const RELAY = import.meta.env.VITE_RELAY_URL || 'http://localhost:8787'

function riskColor(risk) {
  return risk === 'HIGH' ? '#ef4444' : risk === 'ELEVATED' ? '#f59e0b' : '#38bdf8'
}

function timeAgo(ts) {
  if (!ts) return 'n/a'
  const diff = Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000))
  if (diff < 2) return 'just now'
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function freshnessColor(ageMs, warnS = 90, badS = 240) {
  if (!ageMs) return '#888'
  if (ageMs / 1000 >= badS) return '#ef4444'
  if (ageMs / 1000 >= warnS) return '#f59e0b'
  return '#22c55e'
}

function hotspotDataRows(h) {
  return [
    ['Close Region', h.region],
    ['Risk', h.risk],
    ['Severity', `${Math.round(h.severity * 100)}/100`],
    ['Primary note', h.note],
    ['Trigger pattern', h.trigger],
    ['Lat/Lon', `${h.lat.toFixed(3)}, ${h.lng.toFixed(3)}`]
  ]
}

function hotspotTooltip(h, color) {
  return [`<b>${h.name}</b>`, ...hotspotDataRows(h).map(([k, v]) => k === 'Risk' ? `${k}: <span style="color:${color}">${v}</span>` : `${k}: ${v}`)].join('<br/>')
}

function kmBetween(aLat, aLon, bLat, bLon) {
  const p = Math.PI / 180
  const dLat = (bLat - aLat) * p
  const dLon = (bLon - aLon) * p
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(aa))
}

function byTimeWindow(flights, tsField, minutes) {
  if (!tsField) return flights
  const maxAgeMs = minutes * 60 * 1000
  const now = Date.now()
  return flights.filter(f => {
    if (!f[tsField]) return true
    return now - Number(f[tsField]) <= maxAgeMs
  })
}

function readPersistedControls() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export default function MapPanel() {
  const mapRef = useRef(null)
  const mapObjRef = useRef(null)
  const hotspotLayerRef = useRef(null)
  const flightLayerRef = useRef(null)
  const trailLayerRef = useRef(null)
  const chokepointLayerRef = useRef(null)
  const tradeRouteLayerRef = useRef(null)
  const baseLayerRef = useRef(null)
  const cableLayerRef = useRef(null)
  const pipelineLayerRef = useRef(null)
  const conflictLayerRef = useRef(null)
  const eventsLayerRef = useRef(null)
  const shippingLayerRef = useRef(null)
  const infraLayerRef = useRef(null)
  const lastFlightsTsRef = useRef(null)
  const refreshIdRef = useRef(null)
  const layersRef = useRef({ hotspots: true, flights: true, trails: true, chokepoints: true, tradeRoutes: true, bases: false, cables: false, pipelines: false, conflicts: true, events: true, shipping: true, infra: true })
  const flightsRef = useRef([])
  const prevRiskRef = useRef(null)

  const persisted = readPersistedControls()

  const [selected, setSelected] = useState(null)
  const [activePreset, setActivePreset] = useState(persisted?.activePreset && PRESETS[persisted.activePreset] ? persisted.activePreset : 'GLOBAL')
  const [layers, setLayers] = useState(persisted?.layers || { hotspots: true, flights: true, trails: true, chokepoints: true, tradeRoutes: true, bases: false, cables: false, pipelines: false, conflicts: true, events: true, shipping: true, infra: true })
  const [timeWindow, setTimeWindow] = useState(persisted?.timeWindow && TIME_WINDOWS[persisted.timeWindow] ? persisted.timeWindow : '24H')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQ, setPaletteQ] = useState('')
  const [freshnessTick, setFreshnessTick] = useState(0)
  const [riskFusion, setRiskFusion] = useState({ score: 0, trend: 'stable', hotspots: 0, nearFlights: 0, updatedTs: null })
  const [_flightHealth, setFlightHealth] = useState({ lastOkTs: null, lastErrorTs: null, lastError: null })
  const [liveFeedsOpen, setLiveFeedsOpen] = useState(false)

  const activePresetRef = useRef(activePreset)
  const timeWindowRef = useRef(timeWindow)

  const commandInputRef = useRef(null)

  const recomputeRiskFusion = (presetKey, flights) => {
    const preset = PRESETS[presetKey] || PRESETS.GLOBAL
    const scopedHotspots = HOTSPOTS.filter(h => kmBetween(preset.center[0], preset.center[1], h.lat, h.lng) <= preset.scopeKm)
    const hotspotSeverityAvg = scopedHotspots.length
      ? scopedHotspots.reduce((acc, h) => acc + h.severity, 0) / scopedHotspots.length
      : 0

    let nearFlights = 0
    const nearRadiusKm = 220
    if (scopedHotspots.length && flights.length) {
      for (const f of flights) {
        let nearAny = false
        for (const h of scopedHotspots) {
          if (kmBetween(f.lat, f.lon, h.lat, h.lng) <= nearRadiusKm) {
            nearAny = true
            break
          }
        }
        if (nearAny) nearFlights += 1
      }
    }

    const hotspotComponent = Math.round(hotspotSeverityAvg * 70)
    const flightComponent = Math.min(30, nearFlights * 2)
    const score = Math.max(0, Math.min(100, hotspotComponent + flightComponent))
    const prev = prevRiskRef.current
    const trend = prev == null ? 'stable' : score - prev >= 3 ? 'rising' : prev - score >= 3 ? 'falling' : 'stable'
    prevRiskRef.current = score

    setRiskFusion({ score, trend, hotspots: scopedHotspots.length, nearFlights, updatedTs: Date.now() })
  }

  const getHotspotBrief = (h) => {
    const nearby = (flightsRef.current || []).filter(f => kmBetween(h.lat, h.lng, f.lat, f.lon) <= 220)
    const fastest = [...nearby].sort((a, b) => (b.speedKmh || 0) - (a.speedKmh || 0)).slice(0, 3)
    const recentSignals = [
      `${nearby.length} military flights within 220km`,
      `Severity ${Math.round(h.severity * 100)}/100 · ${h.risk}`,
      `Trigger: ${h.trigger}`
    ]
    return { nearbyCount: nearby.length, fastest, recentSignals }
  }

  useEffect(() => {
    const id = setInterval(() => setFreshnessTick(x => x + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activePreset, layers, timeWindow }))
  }, [activePreset, layers, timeWindow])

  useEffect(() => {
    activePresetRef.current = activePreset
  }, [activePreset])

  useEffect(() => {
    timeWindowRef.current = timeWindow
  }, [timeWindow])

  useEffect(() => {
    if (mapObjRef.current) return

    const map = L.map(mapRef.current, { zoomControl: true }).setView(PRESETS[activePresetRef.current].center, PRESETS[activePresetRef.current].zoom)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, minZoom: 2, subdomains: 'abcd', attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }).addTo(map)

    hotspotLayerRef.current = L.layerGroup().addTo(map)
    flightLayerRef.current = L.layerGroup().addTo(map)
    trailLayerRef.current = L.layerGroup().addTo(map)
    chokepointLayerRef.current = L.layerGroup().addTo(map)
    tradeRouteLayerRef.current = L.layerGroup().addTo(map)
    baseLayerRef.current = L.layerGroup().addTo(map)
    cableLayerRef.current = L.layerGroup().addTo(map)
    pipelineLayerRef.current = L.layerGroup().addTo(map)
    conflictLayerRef.current = L.layerGroup().addTo(map)
    eventsLayerRef.current = L.layerGroup().addTo(map)
    shippingLayerRef.current = L.layerGroup().addTo(map)
    infraLayerRef.current = L.layerGroup().addTo(map)
    mapObjRef.current = map

    HOTSPOTS.forEach(h => {
      const color = riskColor(h.risk)
      const ring = L.circle([h.lat, h.lng], {
        radius: 45000 + h.severity * 80000,
        color,
        weight: 1.4,
        fillColor: color,
        fillOpacity: 0.20
      })
      ring.bindTooltip(hotspotTooltip(h, color), { direction: 'top', opacity: 0.97, className: 'horus-zone-tip' })
      ring.on('click', () => setSelected({ kind: 'hotspot', color, ...h }))
      ring.addTo(hotspotLayerRef.current)
    })


    CHOKEPOINTS.forEach(c => {
      const m = L.circleMarker([c.lat, c.lng], { radius: 5, color: '#f97316', weight: 1.5, fillColor: '#f97316', fillOpacity: 0.9 })
      m.bindTooltip(`<b>${c.name}</b><br/>Maritime chokepoint`, { direction: 'top', opacity: 0.95 })
      m.addTo(chokepointLayerRef.current)
    })

    TRADE_ROUTES.forEach(r => {
      const line = L.polyline(r.points, { color: '#22d3ee', weight: 2, opacity: 0.65, dashArray: '6,6' })
      line.bindTooltip(`<b>${r.name}</b>`, { sticky: true })
      line.addTo(tradeRouteLayerRef.current)
    })

    BASES.forEach(b => {
      const m = L.circleMarker([b.lat, b.lng], { radius: 4, color: '#a78bfa', weight: 1.5, fillColor: '#a78bfa', fillOpacity: 0.9 })
      m.bindTooltip(`<b>${b.name}</b><br/>Military base`, { direction: 'top', opacity: 0.95 })
      m.addTo(baseLayerRef.current)
    })


    CABLES.forEach(c => {
      const line = L.polyline(c.points, { color: '#60a5fa', weight: 2, opacity: 0.55 })
      line.bindTooltip(`<b>${c.name}</b><br/>Undersea cable`, { sticky: true })
      line.addTo(cableLayerRef.current)
    })

    PIPELINES.forEach(p => {
      const line = L.polyline(p.points, { color: '#fb7185', weight: 2, opacity: 0.6, dashArray: '8,4' })
      line.bindTooltip(`<b>${p.name}</b><br/>Pipeline`, { sticky: true })
      line.addTo(pipelineLayerRef.current)
    })

    CONFLICT_ZONES.forEach(z => {
      const ring = L.circle([z.lat, z.lng], { radius: z.radiusKm * 1000, color: '#ef4444', weight: 1.2, fillColor: '#ef4444', fillOpacity: 0.12 })
      ring.bindTooltip(`<b>${z.name}</b><br/>Conflict zone`, { direction: 'top', opacity: 0.95 })
      ring.addTo(conflictLayerRef.current)
    })


    GEO_EVENTS.forEach(e => {
      const color = e.category === 'strike' ? '#ef4444' : '#f59e0b'
      const m = L.circleMarker([e.lat, e.lng], { radius: 4 + Math.round((e.severity || 50) / 20), color, weight: 1.2, fillColor: color, fillOpacity: 0.9 })
      m.bindTooltip(`<b>${e.title}</b><br/>${e.category.toUpperCase()} · Severity ${e.severity}/100<br/>${e.source}`, { direction:'top', opacity:0.95 })
      m.addTo(eventsLayerRef.current)
    })

    SHIPPING_INCIDENTS.forEach(si => {
      const color = si.status === 'disrupted' ? '#fb7185' : '#22c55e'
      const m = L.circleMarker([si.lat, si.lng], { radius: 6, color, weight: 1.2, fillColor: color, fillOpacity: 0.9 })
      m.bindTooltip(`<b>${si.title}</b><br/>Route: ${si.route}<br/>Status: ${si.status}`, { direction:'top', opacity:0.95 })
      m.addTo(shippingLayerRef.current)
    })

    INFRA_OUTAGES.forEach(io => {
      const color = io.impact === 'high' ? '#f97316' : '#f59e0b'
      const m = L.circleMarker([io.lat, io.lng], { radius: 7, color, weight: 1.2, fillColor: color, fillOpacity: 0.9 })
      m.bindTooltip(`<b>${io.name}</b><br/>${io.infraType.toUpperCase()} · impact: ${io.impact}`, { direction:'top', opacity:0.95 })
      m.addTo(infraLayerRef.current)
    })

    const syncZoomDisclosure = () => {
      const z = map.getZoom()
      const showTrailsAtZoom = z >= 4
      if (layersRef.current.trails && showTrailsAtZoom) {
        if (!map.hasLayer(trailLayerRef.current)) trailLayerRef.current.addTo(map)
      } else {
        if (map.hasLayer(trailLayerRef.current)) map.removeLayer(trailLayerRef.current)
      }
    }

    map.on('zoomend', syncZoomDisclosure)

    const loadFlights = async () => {
      try {
        const r = await fetch(`${RELAY}/api/flights`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        lastFlightsTsRef.current = j?.ts || Date.now()
        setFlightHealth({ lastOkTs: lastFlightsTsRef.current, lastErrorTs: null, lastError: null })

        flightLayerRef.current.clearLayers()
        trailLayerRef.current.clearLayers()

        const rawFlights = j.flights || []
        const filteredFlights = byTimeWindow(rawFlights, 'updatedTs', TIME_WINDOWS[timeWindowRef.current].minutes)
        flightsRef.current = filteredFlights

        filteredFlights.forEach(x => {
          const cs = norm(x.callsign)
          const color = cs.length >= 4 ? '#f59e0b' : '#38bdf8'
          const marker = L.circleMarker([x.lat, x.lon], { radius: 4, color, weight: 1, fillColor: color, fillOpacity: 0.95 })
          marker.bindTooltip(`MIL ${cs || 'UNKNOWN'}${x.speedKmh ? ` · ${x.speedKmh} km/h` : ''}`)
          marker.on('click', () => setSelected({ kind: 'flight', color, callsign: cs || 'UNKNOWN', ...x, updatedTs: lastFlightsTsRef.current }))
          marker.addTo(flightLayerRef.current)

          const key = cs || `${x.lat.toFixed(2)},${x.lon.toFixed(2)}`
          trackHistory[key] = trackHistory[key] || []
          trackHistory[key].push([x.lat, x.lon])
          if (trackHistory[key].length > 16) trackHistory[key].shift()
          if (trackHistory[key].length >= 2) {
            L.polyline(trackHistory[key], { color, weight: 2, opacity: 0.7 }).addTo(trailLayerRef.current)
          }
        })

        recomputeRiskFusion(activePresetRef.current, filteredFlights)
        syncZoomDisclosure()
      } catch (err) {
        setFlightHealth(prev => ({
          ...prev,
          lastErrorTs: Date.now(),
          lastError: err?.message || 'fetch failure'
        }))
      }
    }

    loadFlights()
    refreshIdRef.current = setInterval(loadFlights, 30000)

    return () => {
      if (refreshIdRef.current) clearInterval(refreshIdRef.current)
      map.off('zoomend', syncZoomDisclosure)
    }
  }, [timeWindow])

  useEffect(() => {
    layersRef.current = layers
    const map = mapObjRef.current
    if (!map) return

    const layerTargets = [
      ['hotspots', hotspotLayerRef.current],
      ['flights', flightLayerRef.current],
      ['trails', trailLayerRef.current],
      ['chokepoints', chokepointLayerRef.current],
      ['tradeRoutes', tradeRouteLayerRef.current],
      ['bases', baseLayerRef.current],
      ['cables', cableLayerRef.current],
      ['pipelines', pipelineLayerRef.current],
      ['conflicts', conflictLayerRef.current],
      ['events', eventsLayerRef.current],
      ['shipping', shippingLayerRef.current],
      ['infra', infraLayerRef.current]
    ]

    layerTargets.forEach(([name, layer]) => {
      if (!layer) return
      if (layers[name]) {
        if (!map.hasLayer(layer)) layer.addTo(map)
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer)
      }
    })
  }, [layers])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
        setTimeout(() => commandInputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const applyPreset = (key) => {
    const map = mapObjRef.current
    if (!map || !PRESETS[key]) return
    setActivePreset(key)
    map.setView(PRESETS[key].center, PRESETS[key].zoom, { animate: true })
    recomputeRiskFusion(key, flightsRef.current)
  }

  const runCommand = (cmd) => {
    if (cmd.type === 'preset') applyPreset(cmd.key)
    if (cmd.type === 'layer') setLayers(s => ({ ...s, [cmd.key]: !s[cmd.key] }))
    if (cmd.type === 'window') setTimeWindow(cmd.key)
    setPaletteOpen(false)
    setPaletteQ('')
  }

  const commandPool = [
    ...Object.keys(PRESETS).map(key => ({ type: 'preset', key, label: `Preset: ${PRESETS[key].label}` })),
    ...Object.keys(TIME_WINDOWS).map(key => ({ type: 'window', key, label: `Time window: ${TIME_WINDOWS[key].label}` })),
    { type: 'layer', key: 'hotspots', label: `Toggle layer: Hotspots (${layers.hotspots ? 'on' : 'off'})` },
    { type: 'layer', key: 'flights', label: `Toggle layer: Flights (${layers.flights ? 'on' : 'off'})` },
    { type: 'layer', key: 'trails', label: `Toggle layer: Trails (${layers.trails ? 'on' : 'off'})` }
  ]

  const filteredCommands = commandPool.filter(c => c.label.toLowerCase().includes(paletteQ.toLowerCase()))

  const trendColor = riskFusion.trend === 'rising' ? '#ef4444' : riskFusion.trend === 'falling' ? '#22c55e' : '#a3a3a3'
  const flightsAge = lastFlightsTsRef.current ? Date.now() - Number(lastFlightsTsRef.current) : null
  const hotspotsAge = freshnessTick * 1000

  return (
    <div style={{ position: 'relative', minHeight: 0 }}>
      <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 6, color: '#ddd', width: 250 }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.62)', padding: '4px', border: '1px solid #333', borderRadius: 6 }}>
          {Object.entries(PRESETS).map(([key, v]) => (
            <button key={key} onClick={() => applyPreset(key)} style={{ cursor: 'pointer', borderRadius: 4, border: `1px solid ${activePreset === key ? '#4f46e5' : '#333'}`, background: activePreset === key ? '#1f1d4f' : '#111', color: '#ddd', fontSize: 11, padding: '3px 8px' }}>{v.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.62)', padding: '4px', border: '1px solid #333', borderRadius: 6, fontSize: 11 }}>
          {Object.entries(TIME_WINDOWS).map(([key, v]) => (
            <button key={key} onClick={() => setTimeWindow(key)} style={{ cursor: 'pointer', borderRadius: 4, border: `1px solid ${timeWindow === key ? '#0ea5e9' : '#333'}`, background: timeWindow === key ? '#0c2a3b' : '#111', color: '#ddd', fontSize: 11, padding: '3px 8px' }}>{v.label}</button>
          ))}
        </div>

        <div style={{ background: 'rgba(0,0,0,.62)', padding: '5px 6px', border: '1px solid #333', borderRadius: 6, fontSize: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['hotspots', 'Hotspots'], ['flights', 'Flights'], ['trails', 'Trails'], ['chokepoints', 'Chokepoints'], ['tradeRoutes', 'Trade Routes'], ['bases', 'Bases'], ['cables', 'Cables'], ['pipelines', 'Pipelines'], ['conflicts', 'Conflicts'], ['events', 'Events'], ['shipping', 'Shipping'], ['infra', 'Infra']].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
              <input type='checkbox' checked={layers[key]} onChange={(e) => setLayers(s => ({ ...s, [key]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>

        <div style={{ background: 'rgba(0,0,0,.72)', padding: '6px 8px', border: '1px solid #333', borderRadius: 6, fontSize: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b>Regional Risk Fusion</b><span style={{ color: trendColor, fontWeight: 700, textTransform: 'uppercase' }}>{riskFusion.trend}</span></div>
          <div style={{ marginTop: 3, fontSize: 16, fontWeight: 800 }}>{riskFusion.score}/100</div>
          <div style={{ marginTop: 4, color: '#aaa' }}>Hotspots in scope: {riskFusion.hotspots} · Flights near hotspots: {riskFusion.nearFlights}</div>
          <div style={{ marginTop: 2, color: '#777' }}>Updated: {timeAgo(riskFusion.updatedTs)}</div>
          <div style={{ marginTop: 4, color:'#8aa1c8' }}>Scores: {COUNTRY_SCORES.map(c => `${c.iso2} ${c.riskScore}`).join(' · ')}</div>
        </div>

        <div style={{ background: 'rgba(0,0,0,.72)', padding: '6px 8px', border: '1px solid #333', borderRadius: 6, fontSize: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Data Freshness</div>
          <div style={{ color: freshnessColor(flightsAge), display: 'flex', justifyContent: 'space-between' }}><span>Flights</span><span>{timeAgo(lastFlightsTsRef.current)}</span></div>
          <div style={{ color: freshnessColor(hotspotsAge, 900, 3600), display: 'flex', justifyContent: 'space-between' }}><span>Hotspots</span><span>static baseline</span></div>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={() => setLiveFeedsOpen(true)} style={{ cursor:'pointer', borderRadius:6, border:'1px solid #2b3a55', background:'#111827', color:'#cfe3ff', fontSize:10, padding:'5px 8px' }}>
            Live YouTube Feeds
          </button>
        </div>


      </div>

      <div style={{ position: 'absolute', bottom: 10, left: 14, zIndex: 1000, display: 'flex', gap: 12, fontSize: 10, color: '#ddd', background: 'rgba(0,0,0,.5)', padding: '4px 8px', border: '1px solid #333' }}>
        <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#ef4444', marginRight: 4 }} />HOTSPOT</span>
        <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', marginRight: 4 }} />FLIGHT</span>
        <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#38bdf8', marginRight: 4 }} />TRAIL</span>
        <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#f97316', marginRight: 4 }} />CHOKEPOINT</span>
        <span><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px dashed #22d3ee', marginRight: 4, position:'relative', top:-2 }} />TRADE</span>
        <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', marginRight: 4 }} />BASE</span>
        <span><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px solid #60a5fa', marginRight: 4, position:'relative', top:-2 }} />CABLE</span>
        <span><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px dashed #fb7185', marginRight: 4, position:'relative', top:-2 }} />PIPELINE</span>
        <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#ef4444', marginRight: 4, opacity:0.6 }} />CONFLICT</span>
        <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#ef4444', marginRight: 4 }} />EVENT</span>
        <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#fb7185', marginRight: 4 }} />SHIPPING</span>
        <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#f97316', marginRight: 4 }} />INFRA</span>
        <span style={{ color: '#888' }}>Cmd/Ctrl+K</span>
      </div>

      {paletteOpen && (
        <div onClick={() => setPaletteOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(700px, 92vw)', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden' }}>
            <input ref={commandInputRef} value={paletteQ} onChange={(e) => setPaletteQ(e.target.value)} placeholder='Type command (preset, time window, layer...)' style={{ width: '100%', boxSizing: 'border-box', background: '#121212', color: '#ddd', border: 0, borderBottom: '1px solid #2a2a2a', padding: '12px 14px', outline: 'none' }} />
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {filteredCommands.map((cmd) => (
                <button key={`${cmd.type}-${cmd.key}`} onClick={() => runCommand(cmd)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #1e1e1e', background: '#0d0d0d', color: '#d8d8d8', padding: '10px 14px', cursor: 'pointer' }}>{cmd.label}</button>
              ))}
              {!filteredCommands.length && <div style={{ color: '#888', padding: '12px 14px' }}>No matches.</div>}
            </div>
          </div>
        </div>
      )}



      {liveFeedsOpen && (
        <div onClick={() => setLiveFeedsOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={(e)=>e.stopPropagation()} style={{ width:'min(1100px, 96vw)', background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:10, padding:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ color:'#ddd', fontSize:13, fontWeight:700 }}>Live YouTube Feeds</div>
              <button onClick={() => setLiveFeedsOpen(false)} style={{ background:'#1a1a1a', color:'#bbb', border:'1px solid #333', borderRadius:6, padding:'4px 8px', cursor:'pointer' }}>Close</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8 }}>
              {LIVE_FEEDS.map(f => (
                <div key={f.channelId} style={{ border:'1px solid #252525', borderRadius:8, overflow:'hidden', background:'#111' }}>
                  <div style={{ padding:'6px 8px', fontSize:11, color:'#cfcfcf', borderBottom:'1px solid #252525' }}>{f.name}</div>
                  <iframe
                    title={f.name}
                    src={`https://www.youtube.com/embed/live_stream?channel=${f.channelId}&autoplay=0&mute=1&controls=1&modestbranding=1&rel=0`}
                    style={{ width:'100%', aspectRatio:'16 / 9', border:0 }}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 92vw)', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 12, padding: 16, color: '#ddd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.kind === 'hotspot' ? selected.name : selected.callsign}</div>
              <button onClick={() => setSelected(null)} style={{ background: '#1a1a1a', color: '#bbb', border: '1px solid #333', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>Close</button>
            </div>

            {selected.kind === 'hotspot' ? (
              <div style={{ lineHeight: 1.45, fontSize: 13 }}>
                {hotspotDataRows(selected).map(([k, v]) => (
                  <div key={k}><b>{k}:</b> {k === 'Risk' ? <span style={{ color: selected.color, fontWeight: 700 }}>{v}</span> : v}</div>
                ))}
                {(() => {
                  const brief = getHotspotBrief(selected)
                  return (
                    <>
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #2a2a2a' }}><b>Country / Hotspot Brief</b></div>
                      <div><b>Active nearby flights:</b> {brief.nearbyCount}</div>
                      <div><b>Recent signals:</b></div>
                      <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                        {brief.recentSignals.map(s => <li key={s}>{s}</li>)}
                      </ul>
                      {brief.fastest.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <b>Top active callsigns:</b> {brief.fastest.map(f => norm(f.callsign) || 'UNKNOWN').join(', ')}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            ) : (
              <div style={{ lineHeight: 1.45, fontSize: 13 }}>
                <div><b>ICAO24:</b> {selected.icao24 || 'n/a'}</div>
                <div><b>Speed:</b> {selected.speedKmh ?? 'n/a'} km/h</div>
                <div><b>Position:</b> {Number(selected.lat).toFixed(3)}, {Number(selected.lon).toFixed(3)}</div>
                <div><b>Source layer:</b> Military-filtered ADS-B</div>
                <div style={{ marginTop: 8, color: '#888' }}>Updated: {timeAgo(selected.updatedTs)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
