import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const HOTSPOTS = [
  {name:'Iran',lat:35.7,lng:51.4,severity:1.0,risk:'HIGH',note:'Leadership instability / strike risk'},
  {name:'Israel / Gaza',lat:31.5,lng:34.5,severity:0.95,risk:'HIGH',note:'Active conflict zone'},
  {name:'Strait of Hormuz',lat:26.5,lng:56.5,severity:0.88,risk:'HIGH',note:'Energy chokepoint risk'},
  {name:'Lebanon',lat:33.9,lng:35.8,severity:0.76,risk:'ELEVATED',note:'Border escalation risk'},
  {name:'Red Sea / Yemen',lat:15.0,lng:42.0,severity:0.74,risk:'ELEVATED',note:'Shipping disruption risk'},
  {name:'Ukraine',lat:49,lng:32,severity:0.85,risk:'HIGH',note:'Ongoing war theater'},
  {name:'Taiwan Strait',lat:24.2,lng:121.0,severity:0.62,risk:'WATCH',note:'Strategic tension zone'},
  {name:'Kuwait',lat:29.3,lng:47.9,severity:0.65,risk:'ELEVATED',note:'Regional strike spillover'}
]
const MIL = ['RCH','CMB','RRR','CNV','LAGR','QID','NATO','FORTE','DUKE','HOMER','MOOSE','TITAN','GHOST']
const norm = c => (c||'').trim().toUpperCase()
const trackHistory = {}
const RELAY = import.meta.env.VITE_RELAY_URL || 'http://localhost:8787'

export default function MapPanel() {
  const mapRef = useRef(null)
  const mapObjRef = useRef(null)
  const flightLayerRef = useRef(null)
  const trailLayerRef = useRef(null)

  useEffect(() => {
    if (mapObjRef.current) return
    const map = L.map(mapRef.current, {zoomControl:true}).setView([25,38],2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:8,minZoom:2,attribution:'© OSM'}).addTo(map)
    HOTSPOTS.forEach(h => {
      const color = h.risk === 'HIGH' ? '#ef4444' : h.risk === 'ELEVATED' ? '#f59e0b' : '#38bdf8'
      const ring = L.circle([h.lat,h.lng], {
        radius: 45000 + h.severity * 80000,
        color,
        weight: 1.4,
        fillColor: color,
        fillOpacity: 0.20
      })
      const html = `<div style="min-width:220px;line-height:1.35">
        <div style="font-weight:700;color:#fff;margin-bottom:4px">${h.name}</div>
        <div style="font-size:11px;color:#ddd;margin-bottom:4px">${h.note}</div>
        <div style="font-size:10px;color:${color};font-weight:700">RISK: ${h.risk}</div>
      </div>`
      ring.bindTooltip(html, { direction: 'top', opacity: 0.97, className: 'horus-zone-tip' }).addTo(map)
    })
    flightLayerRef.current = L.layerGroup().addTo(map)
    trailLayerRef.current = L.layerGroup().addTo(map)
    mapObjRef.current = map

    const load = async () => {
      try {
        const r = await fetch(`${RELAY}/api/flights`)
        const j = await r.json()
        flightLayerRef.current.clearLayers()
        trailLayerRef.current.clearLayers()
        ;(j.flights||[]).forEach(x => {
          const cs = norm(x.callsign), color = cs.length>=4?'#f59e0b':'#38bdf8'
          L.circleMarker([x.lat,x.lon],{radius:4,color,weight:1,fillColor:color,fillOpacity:0.95}).bindTooltip(`MIL ${cs}${x.speedKmh?` · ${x.speedKmh} km/h`:''}`).addTo(flightLayerRef.current)
          const key = cs||`${x.lat.toFixed(2)},${x.lon.toFixed(2)}`
          trackHistory[key] = trackHistory[key]||[]; trackHistory[key].push([x.lat,x.lon])
          if(trackHistory[key].length>16) trackHistory[key].shift()
          if(trackHistory[key].length>=2) L.polyline(trackHistory[key],{color,weight:2,opacity:0.7}).addTo(trailLayerRef.current)
        })
      } catch {}
    }
    load(); const id = setInterval(load,30000); return () => clearInterval(id)
  }, [])

  return (
    <div style={{position:'relative',minHeight:0}}>
      <div ref={mapRef} style={{position:'absolute',inset:0}}/>
      <div style={{position:'absolute',bottom:10,left:14,zIndex:1000,display:'flex',gap:12,fontSize:10,color:'#ddd',background:'rgba(0,0,0,.5)',padding:'4px 8px',border:'1px solid #333'}}>
        <span><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'#ef4444',marginRight:4}}/>HOTSPOT</span>
        <span><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'#f59e0b',marginRight:4}}/>FLIGHT</span>
        <span><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'#38bdf8',marginRight:4}}/>TRAIL</span>
      </div>
    </div>
  )
}
