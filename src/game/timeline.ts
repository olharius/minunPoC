import { getPort, PORTS, type Port } from '../data/ports'
import { SHIP_TYPES, type ShipType } from '../data/shipTypes'
import { dayOfDate, yearAt } from './calendar'

// The world moves on from 1990: market eras come and go, new ports open and
// new ship designs reach the yards. Everything follows from the game day, so
// nothing extra is stored in the save.

export interface Era {
  id: string
  /** [year, month] the era begins and ends (end exclusive). */
  from: [number, number]
  to: [number, number]
  title: string
  text: string
  /** Freight pay multiplier per cargo id. */
  cargo?: Record<string, number>
  /** Freight pay multiplier for offers from ports in these regions. */
  regions?: Record<string, number>
  /** Multiplier on all freight pay. */
  all?: number
  /** Multiplier on bunker prices. */
  fuel?: number
}

// Loosely after the real world, in our own words.
export const ERAS: Era[] = [
  {
    id: 'gulf-crisis',
    from: [1990, 8],
    to: [1991, 4],
    title: 'Öljykriisi Persianlahdella',
    text: 'Levottomuudet Persianlahdella nostavat öljyn hintaa. Polttoaine kallistuu, ja raakaöljyn rahdit ovat kysyttyjä.',
    cargo: { 'crude-oil': 1.3 },
    fuel: 1.35,
  },
  {
    id: 'asia-rise',
    from: [1993, 1],
    to: [1997, 7],
    title: 'Aasian talousihme',
    text: 'Itä-Aasian talouksien kasvu kiihtyy. Konttien ja rautamalmin kysyntä kasvaa.',
    cargo: { containers: 1.15, 'iron-ore': 1.15 },
  },
  {
    id: 'asia-crisis',
    from: [1997, 7],
    to: [1999, 7],
    title: 'Aasian talouskriisi',
    text: 'Valuuttakriisi iskee Itä-Aasiaan. Alueelta lähtevien rahtien hinnat romahtavat, ja öljy halpenee.',
    regions: { 'Itä-Aasia': 0.8 },
    fuel: 0.85,
  },
  {
    id: 'china-boom',
    from: [2002, 1],
    to: [2008, 9],
    title: 'Kiinan kauppabuumi',
    text: 'Kiina avautuu maailmankaupalle. Konttirahti kasvaa, ja raaka-aineiden supersykli nostaa malmin ja hiilen rahteja.',
    cargo: { containers: 1.2, 'iron-ore': 1.3, coal: 1.25, steel: 1.15 },
  },
  {
    id: 'oil-peak',
    from: [2004, 1],
    to: [2008, 9],
    title: 'Kallis öljy',
    text: 'Raakaöljyn hinta nousee ennätyksiin. Polttoaine on kallista, joten säästöajo kannattaa.',
    fuel: 1.4,
  },
  {
    id: 'financial-crisis',
    from: [2008, 9],
    to: [2010, 7],
    title: 'Maailmanlaajuinen finanssikriisi',
    text: 'Pankit horjuvat ja kauppa hiljenee. Kaikkien rahtien hinnat putoavat, mutta polttoaine halpenee.',
    all: 0.7,
    fuel: 0.75,
  },
]

const eraRange = (e: Era) => [dayOfDate(...e.from), dayOfDate(...e.to)] as const

export function activeEras(day: number): Era[] {
  return ERAS.filter((e) => {
    const [a, b] = eraRange(e)
    return day >= a && day < b
  })
}

/** Freight pay multiplier from the eras for a cargo shipped out of a port. */
export function eraPayFactor(day: number, cargoId: string, fromPortId: string): number {
  const region = getPort(fromPortId).region
  return activeEras(day).reduce((f, e) => f * (e.all ?? 1) * (e.cargo?.[cargoId] ?? 1) * (e.regions?.[region] ?? 1), 1)
}

export function eraFuelFactor(day: number): number {
  return activeEras(day).reduce((f, e) => f * (e.fuel ?? 1), 1)
}

export function portOpen(p: Pick<Port, 'openFrom'>, day: number): boolean {
  return !p.openFrom || yearAt(day) >= p.openFrom
}

export function openPorts(day: number): Port[] {
  return PORTS.filter((p) => portOpen(p, day))
}

export function shipTypeAvailable(t: Pick<ShipType, 'availableFrom'>, day: number): boolean {
  return !t.availableFrom || yearAt(day) >= t.availableFrom
}

export function availableShipTypes(day: number): ShipType[] {
  return SHIP_TYPES.filter((t) => shipTypeAvailable(t, day))
}

/** Bigger container lots once the giant ships exist. */
export function containerLotMax(day: number): number {
  return yearAt(day) >= 1996 ? 60000 : 40000
}

/** Headlines for things that start on this day: eras, new ports, new ship types. */
export function timelineNews(day: number): string[] {
  const out: string[] = []
  for (const e of ERAS) {
    const [a, b] = eraRange(e)
    if (day === a) out.push(`${e.title}: ${e.text}`)
    if (day === b) out.push(`${e.title} on ohi. Markkinat palaavat ennalleen.`)
  }
  if (day > 0 && yearAt(day) !== yearAt(day - 1)) {
    const y = yearAt(day)
    for (const p of PORTS) if (p.openFrom === y) out.push(`Uusi satama avattiin: ${p.name} (${p.country}). Siellä on uusia rahteja tarjolla.`)
    for (const t of SHIP_TYPES) if (t.availableFrom === y) out.push(`Telakoilla uusi laivatyyppi: ${t.name}. ${t.description}`)
  }
  return out
}
