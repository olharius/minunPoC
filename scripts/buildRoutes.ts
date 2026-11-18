// Builds src/data/routes.json: the sea route between every pair of ports.
//
//   npm run routes
//
// Run it again after adding a port. How it works: land from Natural Earth
// (1:50m) is rasterised onto a 0.5° grid, canals and narrow straits are
// carved open, and A* finds the shortest water path, which is then
// straightened with line-of-sight checks.

import { readFileSync, writeFileSync } from 'node:fs'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { PORTS } from '../src/data/ports'
import { CANALS } from '../src/data/canals'

const RES = 0.5
const COLS = 360 / RES
const ROWS = 180 / RES
const MAX_LAT = 72 // no Arctic passages
const MIN_LAT = -62 // stay off Antarctic ice

type LonLat = [number, number]

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/land-50m.json', import.meta.url), 'utf8')) as Topology<{
  land: GeometryCollection
}>
const land = feature(topo, topo.objects.land)

// ---- rasterise land (even-odd scanline fill per row) ----
const blocked = new Uint8Array(COLS * ROWS)
const idx = (c: number, r: number) => r * COLS + c
const lonOf = (c: number) => -180 + (c + 0.5) * RES
const latOf = (r: number) => 90 - (r + 0.5) * RES
const colOf = (lon: number) => Math.min(COLS - 1, Math.max(0, Math.floor((lon + 180) / RES)))
const rowOf = (lat: number) => Math.min(ROWS - 1, Math.max(0, Math.floor((90 - lat) / RES)))

// Rings may cross the antimeridian; unwrap longitudes so each ring is continuous.
const rings: LonLat[][] = []
for (const f of land.features) {
  const g = f.geometry
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  for (const poly of polys) {
    // Outer ring only: holes are lakes, which ships can't reach anyway.
    const ring = poly[0] as LonLat[]
    const out: LonLat[] = [ring[0]]
    let shift = 0
    for (let i = 1; i < ring.length; i++) {
      const dx = ring[i][0] + shift - out[i - 1][0]
      if (dx > 180) shift -= 360
      else if (dx < -180) shift += 360
      out.push([ring[i][0] + shift, ring[i][1]])
    }
    rings.push(out)
  }
}

for (let r = 0; r < ROWS; r++) {
  const lat = latOf(r)
  if (lat > MAX_LAT || lat < MIN_LAT) {
    for (let c = 0; c < COLS; c++) blocked[idx(c, r)] = 1
    continue
  }
  for (const ring of rings) {
    const xs: number[] = []
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]
      const [x2, y2] = ring[i + 1]
      if (y1 <= lat !== y2 <= lat) xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1))
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const first = Math.ceil((xs[i] + 180) / RES - 0.5)
      const last = Math.floor((xs[i + 1] + 180) / RES - 0.5)
      for (let c = first; c <= last; c++) blocked[idx(((c % COLS) + COLS) % COLS, r)] = 1
    }
  }
}

// ---- carve canals and straits ----
const canalCells = new Map<number, string>()
function carve(path: LonLat[], tag?: string) {
  for (let i = 0; i < path.length - 1; i++) {
    const [a, b] = [path[i], path[i + 1]]
    const steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / (RES / 4)) + 1
    let prev: [number, number] | null = null
    const open = (c: number, r: number) => {
      const k = idx(c, r)
      blocked[k] = 0
      if (tag) canalCells.set(k, tag)
    }
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const c = colOf(a[0] + (b[0] - a[0]) * t)
      const r = rowOf(a[1] + (b[1] - a[1]) * t)
      // keep the channel 4-connected so ships never squeeze between two land corners
      if (prev && prev[0] !== c && prev[1] !== r) open(c, prev[1])
      open(c, r)
      prev = [c, r]
    }
  }
}
for (const c of CANALS) carve(c.path, c.id)
// Narrow straits that the 0.5° grid closes.
const STRAITS: LonLat[][] = [
  [[-6.5, 35.95], [-4.8, 36.05]], // Gibraltar
  [[34.0, 27.5], [36.0, 24.0], [38.5, 20.0], [41.0, 16.0], [42.6, 13.8], [43.4, 12.6], [44.5, 12.2]], // Red Sea and Bab-el-Mandeb
  [[10.6, 57.7], [11.0, 56.6], [10.9, 55.6], [11.0, 55.0], [11.3, 54.5], [12.2, 54.4]], // Danish straits (Great Belt)
  [[1.0, 50.8], [1.8, 51.2]], // Dover
  [[9.97, 53.54], [9.3, 53.85], [8.2, 54.0]], // Elbe to Hamburg
  [[0.3, 51.5], [1.5, 51.5]], // Thames
  [[103.6, 1.15], [104.4, 1.25]], // Singapore Strait
  [[56.0, 26.2], [56.8, 26.6]], // Hormuz
  [[119.5, 24.3], [120.0, 25.2]], // Taiwan Strait
  [[-123.5, 48.25], [-123.1, 49.2]], // Strait of Georgia (Vancouver)
  [[2.0, 50.0], [-1.0, 49.8]], // Channel
]
for (const s of STRAITS) carve(s)

// ---- the world ocean: water connected to the mid-Atlantic ----
const ocean = new Uint8Array(COLS * ROWS)
{
  const stack = [idx(colOf(-30), rowOf(0))]
  while (stack.length) {
    const k = stack.pop()!
    if (ocean[k] || blocked[k]) continue
    ocean[k] = 1
    const c = k % COLS
    const r = Math.floor(k / COLS)
    if (r > 0) stack.push(idx(c, r - 1))
    if (r < ROWS - 1) stack.push(idx(c, r + 1))
    stack.push(idx((c + 1) % COLS, r), idx((c - 1 + COLS) % COLS, r))
  }
}

// ---- port cells: nearest ocean cell ----
function nearestWater(lon: number, lat: number): number {
  const c0 = colOf(lon)
  const r0 = rowOf(lat)
  for (let rad = 0; rad < 12; rad++) {
    let best = -1
    let bestD = Infinity
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue
        const c = (c0 + dc + COLS) % COLS
        const r = r0 + dr
        if (r < 0 || r >= ROWS || !ocean[idx(c, r)] || canalCells.has(idx(c, r))) continue
        const d = dr * dr + dc * dc
        if (d < bestD) {
          bestD = d
          best = idx(c, r)
        }
      }
    if (best >= 0) return best
  }
  throw new Error(`No water near ${lon},${lat}`)
}

// Debug: DEBUG_BOX=lon1,lat1,lon2,lat2 prints the grid there and exits.
if (process.env.DEBUG_BOX) {
  const [x1, y1, x2, y2] = process.env.DEBUG_BOX.split(',').map(Number)
  const marks = new Map(PORTS.map((p) => [nearestWater(p.lon, p.lat), p.id[0].toUpperCase()]))
  for (let r = rowOf(y2); r <= rowOf(y1); r++) {
    let line = latOf(r).toFixed(2).padStart(7) + ' '
    for (let c = colOf(x1); c <= colOf(x2); c++) line += marks.get(idx(c, r)) ?? (blocked[idx(c, r)] ? '#' : canalCells.has(idx(c, r)) ? '=' : '.')
    console.log(line)
  }
  process.exit(0)
}

// ---- A* ----
const R_NM = 3440.065
const toRad = (d: number) => (d * Math.PI) / 180
function hav(a: LonLat, b: LonLat) {
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)))
}
const cellLL = (k: number): LonLat => [lonOf(k % COLS), latOf(Math.floor(k / COLS))]

class Heap {
  k: number[] = []
  p: number[] = []
  push(k: number, p: number) {
    this.k.push(k)
    this.p.push(p)
    let i = this.k.length - 1
    while (i > 0) {
      const j = (i - 1) >> 1
      if (this.p[j] <= this.p[i]) break
      ;[this.k[i], this.k[j]] = [this.k[j], this.k[i]]
      ;[this.p[i], this.p[j]] = [this.p[j], this.p[i]]
      i = j
    }
  }
  pop(): number {
    const top = this.k[0]
    const lk = this.k.pop()!
    const lp = this.p.pop()!
    if (this.k.length) {
      this.k[0] = lk
      this.p[0] = lp
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < this.k.length && this.p[l] < this.p[m]) m = l
        if (r < this.k.length && this.p[r] < this.p[m]) m = r
        if (m === i) break
        ;[this.k[i], this.k[m]] = [this.k[m], this.k[i]]
        ;[this.p[i], this.p[m]] = [this.p[m], this.p[i]]
        i = m
      }
    }
    return top
  }
  get size() {
    return this.k.length
  }
}

const g = new Float64Array(COLS * ROWS)
const from = new Int32Array(COLS * ROWS)
const seen = new Uint32Array(COLS * ROWS)
let stamp = 0

function astar(start: number, goal: number): number[] {
  stamp++
  const goalLL = cellLL(goal)
  const heap = new Heap()
  g[start] = 0
  from[start] = -1
  seen[start] = stamp
  heap.push(start, 0)
  const closed = new Set<number>()
  while (heap.size) {
    const cur = heap.pop()
    if (cur === goal) break
    if (closed.has(cur)) continue
    closed.add(cur)
    const c = cur % COLS
    const r = Math.floor(cur / COLS)
    const curLL = cellLL(cur)
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue
        const nr = r + dr
        if (nr < 0 || nr >= ROWS) continue
        const nc = (c + dc + COLS) % COLS
        const n = idx(nc, nr)
        if (blocked[n]) continue
        // no corner cutting between two land cells
        if (dr && dc && blocked[idx(nc, r)] && blocked[idx(c, nr)]) continue
        const ng = g[cur] + hav(curLL, cellLL(n))
        if (seen[n] !== stamp || ng < g[n]) {
          seen[n] = stamp
          g[n] = ng
          from[n] = cur
          heap.push(n, ng + hav(cellLL(n), goalLL))
        }
      }
  }
  if (seen[goal] !== stamp) throw new Error('no path')
  const path: number[] = []
  for (let k = goal; k !== -1; k = from[k]) path.push(k)
  return path.reverse()
}

// Line of sight in grid space (no wrap across the antimeridian).
function clear(a: number, b: number): boolean {
  const [c1, r1] = [a % COLS, Math.floor(a / COLS)]
  const [c2, r2] = [b % COLS, Math.floor(b / COLS)]
  if (Math.abs(c2 - c1) > COLS / 2) return false
  const steps = Math.max(Math.abs(c2 - c1), Math.abs(r2 - r1)) * 3
  for (let s = 1; s < steps; s++) {
    const t = s / steps
    const c = Math.round(c1 + (c2 - c1) * t)
    const r = Math.round(r1 + (r2 - r1) * t)
    if (blocked[idx(c, r)]) return false
  }
  return true
}

function smooth(path: number[]): number[] {
  const out = [path[0]]
  let i = 0
  while (i < path.length - 1) {
    let j = path.length - 1
    while (j > i + 1 && !clear(path[i], path[j])) j--
    out.push(path[j])
    i = j
  }
  return out
}

export interface RouteData {
  nm: number
  canals: string[]
  path: LonLat[]
}

// Line-of-sight is checked in lon/lat space, so the drawn line must follow
// lon/lat space too: add points every ≤2° so arcs don't bulge over land.
function densify(pts: LonLat[]): LonLat[] {
  const out: LonLat[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b: LonLat = [pts[i][0], pts[i][1]]
    // across the antimeridian: interpolate the short way round
    if (b[0] - a[0] > 180) b[0] -= 360
    else if (b[0] - a[0] < -180) b[0] += 360
    const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 2)
    for (let s = 1; s <= n; s++) {
      let lon = a[0] + ((b[0] - a[0]) * s) / n
      if (lon > 180) lon -= 360
      if (lon < -180) lon += 360
      out.push([lon, a[1] + ((b[1] - a[1]) * s) / n])
    }
  }
  return out
}

const round = (n: number) => Math.round(n * 100) / 100
const portCell = new Map(PORTS.map((p) => [p.id, nearestWater(p.lon, p.lat)]))
const routes: Record<string, RouteData> = {}
const ids = PORTS.map((p) => p.id).sort()
const t0 = Date.now()
for (let i = 0; i < ids.length; i++)
  for (let j = i + 1; j < ids.length; j++) {
    const a = PORTS.find((p) => p.id === ids[i])!
    const b = PORTS.find((p) => p.id === ids[j])!
    let raw: number[]
    try {
      raw = astar(portCell.get(a.id)!, portCell.get(b.id)!)
    } catch {
      throw new Error(`No sea route ${a.id} → ${b.id}`)
    }
    const canals = [...new Set(raw.map((k) => canalCells.get(k)).filter((x): x is string => !!x))]
    const pts = densify([[a.lon, a.lat], ...smooth(raw).map(cellLL), [b.lon, b.lat]])
    let nm = 0
    for (let k = 0; k < pts.length - 1; k++) nm += hav(pts[k], pts[k + 1])
    routes[`${a.id}|${b.id}`] = { nm: Math.round(nm), canals, path: pts.map(([x, y]) => [round(x), round(y)]) }
  }

writeFileSync(new URL('../src/data/routes.json', import.meta.url), JSON.stringify(routes))
console.log(`${Object.keys(routes).length} routes in ${Date.now() - t0} ms`)
