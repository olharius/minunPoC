// Canals: carved into the sea-route grid by scripts/buildRoutes.ts and
// charged when a voyage passes through them.

export interface Canal {
  id: string
  name: string
  /** Base toll in dollars; scaled by ship capacity at transit. */
  toll: number
  /** Centre line, [lon, lat] points. */
  path: [number, number][]
}

export const CANALS: Canal[] = [
  {
    id: 'suez',
    name: 'Suezin kanava',
    toll: 60000,
    path: [
      [32.3, 31.4],
      [32.32, 30.6],
      [32.55, 29.9],
      [32.6, 29.5],
      [32.9, 29.0],
      [33.5, 28.0],
      [34.0, 27.5],
    ],
  },
  {
    id: 'panama',
    name: 'Panaman kanava',
    toll: 50000,
    path: [
      [-79.95, 9.5],
      [-79.7, 9.1],
      [-79.55, 8.85],
      [-79.5, 8.6],
    ],
  },
  {
    id: 'kiel',
    name: 'Kielin kanava',
    toll: 8000,
    path: [
      [8.9, 53.85],
      [9.6, 54.1],
      [10.2, 54.4],
    ],
  },
]

const byId = new Map(CANALS.map((c) => [c.id, c]))
export const getCanal = (id: string) => byId.get(id)
