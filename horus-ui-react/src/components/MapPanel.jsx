import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const HOTSPOTS = [
  {name:'Israel/Gaza',lat:32,lng:35,severity:0.9},
  {name:'Iran',lat:35.7,lng:51.4,severity:1.0},
  {name:'Ukraine',lat:49,lng:32,severity:0.85},
  {name:'Kuwait',lat:29.3,lng:47.9,severity:0.65},
  {name:'Yemen',lat:15,lng:42,severity:0.7},
  {name:'Sudan',lat:15.5,lng:32.5,severity:0.55},
]
const MIL = ['RCH','CMB','RRR','CNV','LAGR','QID','NATO','FORTE','DUKE','HOMER','MOOSE','TITAN','GHOST']
const norm = c => (c||'').trim().toUpperCase()
const trackHistory = {}

export default function MapPanel() {
  const mapRef = useRef(null)
  const mapObjRef = useRef(null)
  const flightLayerRef = useRef(null)
  const trailLayerRef = useRef(null)

  useEffect(() => {
    if (mapObjRef.current) return
    const map = L.map(mapRef.current, {zoomControl:true}).setView([25,38],2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:8,minZoom:2,attribution:'© OSM'}).addTo(map)
    HOTSPOTS.forEach(h => L.circle([h.lat,h.lng],{radius:50000+h.severity*70000,color:'#ef4444',weight:1,fillColor:'#ef4444',fillOpacity:0.28}).bindTooltip(h.name).addTo(map))
    flightLayerRef.current = L.layerGroup().addTo(map)
    trailLayerRef.current = L.layerGroup().addTo(map)
    mapObjRef.current = map

    const load = async () => {
      try {
        const r = await fetch('http://localhost:8787/api/flights')
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
