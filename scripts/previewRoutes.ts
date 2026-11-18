// Draws every sea route onto a world map, for checking routes by eye:
//   npx tsx scripts/previewRoutes.ts out.svg
import { readFileSync, writeFileSync } from 'node:fs'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'

const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-50m.json', 'utf8')) as Topology<{ land: GeometryCollection }>
const routes = JSON.parse(readFileSync('src/data/routes.json', 'utf8')) as Record<string, { path: [number, number][] }>
const proj = geoNaturalEarth1().fitExtent(
  [
    [0, 0],
    [2000, 1040],
  ],
  { type: 'Sphere' },
)
const path = geoPath(proj)
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1040"><rect width="2000" height="1040" fill="#246"/>`
svg += `<path d="${path(feature(topo, topo.objects.land))}" fill="#cb9"/>`
for (const r of Object.values(routes)) {
  svg += `<path d="${path({ type: 'LineString', coordinates: r.path })}" fill="none" stroke="red" stroke-width="1" opacity="0.5"/>`
}
writeFileSync(process.argv[2] ?? 'routes.svg', svg + '</svg>')
