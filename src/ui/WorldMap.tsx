import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import landTopo from 'world-atlas/land-110m.json'
import { PORTS, type Port } from '../data/ports'
import { getRoute, pointAlong, remainingPath, type Route } from '../data/routes'
import type { OwnedShip, VoyageHold } from '../game/types'
import { activeHold, voyageProgress } from '../game/voyage'

const W = 1000
const H = 520

const projection = geoNaturalEarth1().fitExtent(
  [
    [6, 6],
    [W - 6, H - 6],
  ],
  { type: 'Sphere' },
)
const path = geoPath(projection)
const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>
const LAND_PATH = path(feature(topo, topo.objects.land)) ?? ''
const SPHERE_PATH = path({ type: 'Sphere' }) ?? ''
const GRATICULE_PATH = path(geoGraticule10()) ?? ''

function getPortSafe(id: string): Port {
  return PORTS.find((p) => p.id === id) ?? PORTS[0]
}

function project(p: Port): [number, number] {
  return projection([p.lon, p.lat]) ?? [0, 0]
}

interface View {
  x: number
  y: number
  w: number
}

interface Props {
  ships: OwnedShip[]
  /** Game time in days, fractional while the clock runs (for smooth movement). */
  time: number
  homePortId: string
  selectedPortId: string | null
  selectedShipId: string | null
  /** A route to highlight, e.g. while choosing a destination. */
  preview: Route | null
  onSelectPort: (id: string | null) => void
  onSelectShip: (id: string) => void
}

interface AtSea {
  ship: OwnedShip
  route: Route
  t: number
  /** Standing still at sea (repairs, pirates). */
  hold: VoyageHold | null
}

function lineD(points: [number, number][]): string {
  return path({ type: 'LineString', coordinates: points }) ?? ''
}

export function WorldMap({ ships, time, homePortId, selectedPortId, selectedShipId, preview, onSelectPort, onSelectShip }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ px: number; py: number; vx: number; vy: number; moved: boolean } | null>(null)
  // Container size in CSS pixels; the viewBox follows its aspect ratio so the map fills it.
  const [size, setSize] = useState({ w: 1000, h: 520 })
  const aspect = size.h / size.w
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width > 0 && height > 0) setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const clampView = (v: View, a = aspect): View => {
    const w = Math.min(W, Math.max(W / 10, v.w))
    const h = w * a
    const x = Math.min(W - w, Math.max(0, v.x))
    const y = h >= H ? (H - h) / 2 : Math.min(H - h, Math.max(0, v.y))
    return { w, x, y }
  }

  const homeView = (a = aspect): View => {
    const w = Math.min(W, H / a)
    const [hx, hy] = project(getPortSafe(homePortId))
    return clampView({ w, x: hx - w / 2, y: hy - (w * a) / 2 }, a)
  }

  // Start (and re-fit on resize) around the home port.
  const v = view ? clampView(view) : homeView()
  const vh = v.w * aspect
  /** CSS pixels per map unit: sizes below are given in screen pixels. */
  const k = size.w / v.w

  const shipsByPort = useMemo(() => {
    const m = new Map<string, OwnedShip[]>()
    for (const s of ships) if (s.portId) m.set(s.portId, [...(m.get(s.portId) ?? []), s])
    return m
  }, [ships])

  const atSea: AtSea[] = ships
    .filter((s) => s.voyage)
    .map((ship) => {
      const v = ship.voyage!
      const route = getRoute(v.from, v.to)
      return { ship, route, t: voyageProgress(v, time), hold: activeHold(v, time) }
    })

  const zoomAt = (factor: number, cx = v.x + v.w / 2, cy = v.y + vh / 2) => {
    const w = v.w / factor
    setView(clampView({ w, x: cx - ((cx - v.x) * w) / v.w, y: cy - ((cy - v.y) * w) / v.w }))
  }

  const toSvg = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    return [v.x + ((clientX - r.left) / r.width) * v.w, v.y + ((clientY - r.top) / r.height) * vh]
  }

  // Greedy label placement: important ports first, skip labels that would overlap.
  const labelled = useMemo(() => {
    const prio = (p: Port) =>
      (p.id === selectedPortId ? 100 : 0) + (p.id === homePortId ? 50 : 0) + (shipsByPort.has(p.id) ? 20 : 0) + p.size
    const placed: [number, number, number, number][] = []
    const out = new Set<string>()
    for (const p of [...PORTS].sort((a, b) => prio(b) - prio(a))) {
      const [x, y] = project(p)
      const sx = x * k
      const sy = y * k
      const w = p.name.length * 6.6 + 6
      const box: [number, number, number, number] = [sx - w / 2, sy - 22, sx + w / 2, sy - 6]
      if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue
      placed.push(box)
      out.add(p.id)
    }
    return out
  }, [k, selectedPortId, homePortId, shipsByPort])

  return (
    <div className="map-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="world-map"
        viewBox={`${v.x} ${v.y} ${v.w} ${vh}`}
        onWheel={(e) => {
          const [cx, cy] = toSvg(e.clientX, e.clientY)
          zoomAt(e.deltaY < 0 ? 1.25 : 0.8, cx, cy)
        }}
        onPointerDown={(e) => {
          drag.current = { px: e.clientX, py: e.clientY, vx: v.x, vy: v.y, moved: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.px
          const dy = e.clientY - d.py
          if (!d.moved && Math.hypot(dx, dy) < 4) return
          if (!d.moved) {
            d.moved = true
            ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
          }
          setView(clampView({ w: v.w, x: d.vx - dx / k, y: d.vy - dy / k }))
        }}
        onPointerUp={(e) => {
          const d = drag.current
          drag.current = null
          if (d && !d.moved && e.target === e.currentTarget) onSelectPort(null)
        }}
      >
        <defs>
          <radialGradient id="ocean" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="var(--ocean-light)" />
            <stop offset="100%" stopColor="var(--ocean-deep)" />
          </radialGradient>
          <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--land-light)" />
            <stop offset="100%" stopColor="var(--land-dark)" />
          </linearGradient>
          <filter id="coast" x="-5%" y="-5%" width="110%" height="110%">
            <feMorphology operator="dilate" radius="1.6" in="SourceAlpha" result="grown" />
            <feGaussianBlur in="grown" stdDeviation="1.8" result="glow" />
            <feFlood floodColor="var(--shallow)" />
            <feComposite in2="glow" operator="in" result="shallow" />
            <feMerge>
              <feMergeNode in="shallow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={SPHERE_PATH} fill="url(#ocean)" pointerEvents="none" />
        <path d={GRATICULE_PATH} className="graticule" pointerEvents="none" />
        <path d={LAND_PATH} fill="url(#land)" className="land" filter="url(#coast)" pointerEvents="none" />
        <path d={SPHERE_PATH} className="sphere-edge" pointerEvents="none" />

        {atSea.map(({ ship, route, t }) => (
          <path
            key={`r-${ship.id}`}
            d={lineD(remainingPath(route, t))}
            className={`route${ship.id === selectedShipId ? ' selected' : ''}`}
            pointerEvents="none"
          />
        ))}
        {preview && <path d={lineD(preview.path)} className="route preview" pointerEvents="none" />}

        {PORTS.map((p) => {
          const [x, y] = project(p)
          const here = shipsByPort.get(p.id) ?? []
          const selected = p.id === selectedPortId
          const r = (2.5 + p.size * 1.2) / k
          const fs = 11 / k
          return (
            <g
              key={p.id}
              data-port={p.id}
              className={`port${selected ? ' selected' : ''}${p.id === homePortId ? ' home' : ''}`}
              transform={`translate(${x},${y})`}
              onPointerUp={(e) => {
                if (drag.current?.moved) return
                e.stopPropagation()
                drag.current = null
                onSelectPort(p.id)
              }}
            >
              <circle r={Math.max(r * 1.8, 9 / k)} className="hit" />
              {selected && <circle r={r * 2.2} className="ring" />}
              <circle r={r} className="dot" />
              {labelled.has(p.id) && (
                <text y={-r - 3 / k} fontSize={fs} strokeWidth={3 / k} textAnchor="middle">
                  {p.name}
                </text>
              )}
              {here.length > 0 && <ShipMarker x={r + 3 / k} scale={1.3 / k} count={here.length} />}
            </g>
          )
        })}

        {atSea.map(({ ship, route, t, hold }) => {
          const [x, y] = projection(pointAlong(route, t)) ?? [0, 0]
          const [ax] = projection(pointAlong(route, Math.min(1, t + 0.02))) ?? [0, 0]
          const [bx] = projection(pointAlong(route, Math.max(0, t - 0.02))) ?? [0, 0]
          const west = ax < bx
          const sc = 1.5 / k
          return (
            <g
              key={`s-${ship.id}`}
              data-ship={ship.id}
              className={`sea-ship${ship.id === selectedShipId ? ' selected' : ''}${hold ? ' held' : ''}`}
              transform={`translate(${x},${y})`}
              onPointerUp={(e) => {
                if (drag.current?.moved) return
                e.stopPropagation()
                drag.current = null
                onSelectShip(ship.id)
              }}
            >
              <circle r={12 / k} className="hit" />
              {ship.id === selectedShipId && <circle r={11 / k} className="ring" />}
              <g transform={`scale(${west ? -sc : sc},${sc}) translate(-8,-6)`}>
                {!hold && <path d="M-6 7 Q-2 6 0 7.5" className="wake" />}
                <path d="M0 4 L16 4 L13.5 8 L2 8 Z" className="hull" />
                <rect x="10" y="0" width="4" height="4" className="bridge" />
                <rect x="3" y="1.5" width="6" height="2.5" className={ship.voyage?.contract ? 'cargo' : 'cargo empty'} />
              </g>
              {hold && (
                <g transform={`translate(0,${-14 / k}) scale(${1 / k})`} className="hold-badge">
                  <title>{hold.reason === 'pirates' ? 'Merirosvojen hallussa' : 'Korjaus käynnissä'}</title>
                  <rect x={-17} y={-9} width={34} height={14} rx={7} />
                  <text y={2} textAnchor="middle">
                    {hold.reason === 'pirates' ? '☠' : '🔧'} {Math.max(1, Math.ceil(hold.until - time))}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
      <div className="map-controls">
        <button onClick={() => zoomAt(1.5)} aria-label="Lähennä">
          +
        </button>
        <button onClick={() => zoomAt(1 / 1.5)} aria-label="Loitonna">
          −
        </button>
        <button onClick={() => setView(null)} aria-label="Kotisatamaan">
          ⤢
        </button>
      </div>
    </div>
  )
}

function ShipMarker({ x, scale, count }: { x: number; scale: number; count: number }) {
  return (
    <g className="ship-marker" transform={`translate(${x},${-2 * scale}) scale(${scale})`}>
      {/* simple side-view hull + superstructure */}
      <path d="M0 4 L16 4 L13.5 8 L2 8 Z" className="hull" />
      <rect x="10" y="0" width="4" height="4" className="bridge" />
      <rect x="3" y="1.5" width="6" height="2.5" className="cargo" />
      {count > 1 && (
        <text x="19" y="8" fontSize="7" className="count">
          ×{count}
        </text>
      )}
    </g>
  )
}
