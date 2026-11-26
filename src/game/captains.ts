import { getPort } from '../data/ports'
import { getShipType } from '../data/shipTypes'
import { monthOf } from './calendar'
import { fmtMoney } from './format'
import { hashString, rng } from './rng'
import { addLog as log, clone, getShip } from './state'
import type { Captain, CaptainTrait, GameState, OwnedShip } from './types'

// Captains: hired at medium and big ports, each with one speciality that grows
// stronger as the captain gains experience at sea.

export const MAX_LEVEL = 5
/** Days at sea needed for each level (index = level − 1). */
export const LEVEL_XP = [0, 90, 220, 400, 650]

export interface TraitInfo {
  id: CaptainTrait
  name: string
  /** What one level gives, in plain Finnish. */
  perLevel: string
}

export const TRAITS: TraitInfo[] = [
  { id: 'navigator', name: 'Navigaattori', perLevel: 'nopeus +2 % / taso' },
  { id: 'saver', name: 'Säästäjä', perLevel: 'polttoaineen kulutus −3 % / taso' },
  { id: 'mechanic', name: 'Konemestaritausta', perLevel: 'konevikoja −15 % ja kulumista −8 % / taso' },
  { id: 'trader', name: 'Kauppias', perLevel: 'rahtitulot +2 % / taso' },
  { id: 'seadog', name: 'Merikarhu', perLevel: 'myrskyvaurioita −8 % ja kaappausriskiä −8 % / taso' },
]

export function traitInfo(id: CaptainTrait): TraitInfo {
  return TRAITS.find((t) => t.id === id)!
}

/** Multipliers a ship's captain gives (1 = no effect). */
export interface ShipMods {
  speed: number
  fuel: number
  wear: number
  engine: number
  storm: number
  hijack: number
  /** Extra share of freight pay, e.g. 0.04. */
  payBonus: number
}

export const NO_MODS: ShipMods = { speed: 1, fuel: 1, wear: 1, engine: 1, storm: 1, hijack: 1, payBonus: 0 }

export function captainMods(ship: Pick<OwnedShip, 'captain'>): ShipMods {
  const c = ship.captain
  if (!c) return NO_MODS
  const L = c.level
  switch (c.trait) {
    case 'navigator':
      return { ...NO_MODS, speed: 1 + 0.02 * L }
    case 'saver':
      return { ...NO_MODS, fuel: 1 - 0.03 * L }
    case 'mechanic':
      return { ...NO_MODS, engine: 1 - 0.15 * L, wear: 1 - 0.08 * L }
    case 'trader':
      return { ...NO_MODS, payBonus: 0.02 * L }
    case 'seadog':
      return { ...NO_MODS, storm: 1 - 0.08 * L, hijack: 1 - 0.08 * L }
  }
}

/** Daily wage, dollars. */
export function captainWage(c: Pick<Captain, 'level'>): number {
  return 300 + 250 * c.level
}

/** One-off hiring fee, dollars. */
export function hiringFee(c: Pick<Captain, 'level'>): number {
  return 20_000 * c.level * c.level
}

const FIRST = ['Aino', 'Eero', 'Helmi', 'Ilkka', 'Johanna', 'Kalle', 'Leena', 'Matti', 'Niina', 'Olli', 'Pekka', 'Riikka', 'Sami', 'Tuula', 'Ville',
  'Anders', 'Ingrid', 'Lars', 'Sofia', 'Marco', 'Elena', 'Jan', 'Maria', 'Carlos', 'Ana', 'Kenji', 'Mei', 'Rahul', 'Amara', 'Tom', 'Grace', 'Ivan', 'Nadia']
const LAST = ['Virtanen', 'Lindqvist', 'Korhonen', 'Nieminen', 'Mäkinen', 'Laine', 'Hansen', 'Andersson', 'Rossi', 'Moreau', 'de Vries', 'Silva',
  'García', 'Papadopoulos', 'Tanaka', 'Chen', 'Kumar', 'Okafor', 'Smith', 'Walsh', 'Petrov', 'Haddad', 'Jensen', 'Novak']

/** Captains looking for a ship at a port this month (medium and big ports only). */
export function captainCandidates(state: GameState, portId: string): Captain[] {
  const p = getPort(portId)
  if (p.size < 2) return []
  const month = monthOf(state.day)
  const r = rng(hashString(`${state.seed}:captains:${portId}:${month}`))
  const out: Captain[] = []
  for (let i = 0; i < p.size; i++) {
    const level = r.pick([1, 2, 3], (l) => [0, 6, 3, 1][l])
    out.push({
      id: `cap-${portId}-${month}-${i}`,
      name: `${r.pick(FIRST)} ${r.pick(LAST)}`,
      trait: r.pick(TRAITS).id,
      level,
      xp: LEVEL_XP[level - 1],
    })
  }
  const taken = new Set(state.takenListings)
  return out.filter((c) => !taken.has(c.id))
}

export function hireCaptain(state: GameState, shipId: string, captainId: string): GameState {
  const s = clone(state)
  const ship = getShip(s, shipId)
  if (!ship.portId) throw new Error('Laiva on merellä.')
  const c = captainCandidates(state, ship.portId).find((x) => x.id === captainId)
  if (!c) throw new Error('Kapteeni on jo palkattu muualle.')
  const fee = hiringFee(c)
  if (fee > s.money) throw new Error('Kassa ei riitä palkkioon.')
  s.money -= fee
  s.ledger.running += fee
  s.takenListings = [...s.takenListings, c.id]
  const old = ship.captain
  ship.captain = c
  log(s, {
    kind: 'shipyard',
    text: `${c.name} (${traitInfo(c.trait).name.toLowerCase()}, taso ${c.level}) palkattiin laivan ${ship.name} kapteeniksi${old ? `. ${old.name} jäi pois` : ''}.`,
    amount: -fee,
  })
  return s
}

export function dismissCaptain(state: GameState, shipId: string): GameState {
  const s = clone(state)
  const ship = getShip(s, shipId)
  if (!ship.captain) return state
  log(s, { kind: 'info', text: `${ship.captain.name} lähti laivalta ${ship.name}.` })
  delete ship.captain
  return s
}

/** A day at sea for the captain: experience and level-ups. Mutates `s`. */
export function captainDayAtSea(s: GameState, ship: OwnedShip) {
  const c = ship.captain
  if (!c) return
  c.xp += 1
  if (c.level < MAX_LEVEL && c.xp >= LEVEL_XP[c.level]) {
    c.level += 1
    log(s, { kind: 'award', text: `Kapteeni ${c.name} (${ship.name}) nousi tasolle ${c.level}: ${traitInfo(c.trait).name.toLowerCase()} entistä taitavampi. Palkka nousee ${fmtMoney(captainWage(c))}/pv.` })
  }
}

/** Days at sea still needed for the next level, or null at the top. */
export function xpToNext(c: Captain): number | null {
  return c.level >= MAX_LEVEL ? null : LEVEL_XP[c.level] - c.xp
}

export function shipDailyCost(ship: OwnedShip): number {
  return getShipType(ship.typeId).dailyCost + (ship.captain ? captainWage(ship.captain) : 0)
}
