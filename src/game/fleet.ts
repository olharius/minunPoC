import { getPort, PORTS } from '../data/ports'
import { getShipType, SHIP_TYPES, type ShipType } from '../data/shipTypes'
import { monthOf } from './calendar'
import { fmtMoney } from './format'
import { fleetNameKeys, isNameTaken, nameKey, uniqueName } from './names'
import { hashString, rng } from './rng'
import { addLog as log, clone, getShip } from './state'
import type { GameState, OwnedShip } from './types'

// Buying, selling and repairing ships.

export { MONTH } from './calendar'
/** New ships are sold at the big hubs; repairs need at least a medium port. */
export const NEWBUILD_PORT_SIZE = 3
export const REPAIR_PORT_SIZE = 2

/** Second-hand value: 20 % for a wreck up to 80 % for a ship in perfect shape. */
export function shipValue(ship: OwnedShip): number {
  const t = getShipType(ship.typeId)
  return Math.round((t.price * (0.2 + 0.6 * (ship.condition / 100))) / 10000) * 10000
}

export function fleetValue(state: GameState): number {
  return state.ships.reduce((s, x) => s + shipValue(x), 0)
}

export interface Repair {
  points: number
  cost: number
  days: number
}

export function repairQuote(ship: OwnedShip): Repair {
  const t = getShipType(ship.typeId)
  const points = Math.max(0, Math.round(100 - ship.condition))
  return { points, cost: Math.round((t.price * 0.0008 * points) / 100) * 100, days: Math.max(1, Math.ceil(points / 8)) }
}

export interface Listing {
  id: string
  portId: string
  typeId: string
  condition: number
  price: number
  /** Suggested name from the previous owner. */
  name: string
}

const USED_NAMES = [
  'Atlantic Star', 'Nordic Trader', 'Ocean Pride', 'Sea Falcon', 'Baltic Carrier', 'Southern Cross', 'Pacific Dawn', 'Cape Runner',
  'Northern Light', 'Golden Gate', 'Blue Horizon', 'Silver Wave', 'Eastern Promise', 'Red Sea Spirit', 'Coral Bay', 'Harbour Queen',
]

/** Second-hand ships for sale at a port this month. */
export function usedListings(state: GameState, portId: string): Listing[] {
  const p = getPort(portId)
  if (p.size < 2) return []
  const month = monthOf(state.day)
  const r = rng(hashString(`${state.seed}:used:${portId}:${month}`))
  const out: Listing[] = []
  // Suggested names never clash with the fleet or with each other.
  const names = fleetNameKeys(state)
  for (let i = 0; i < p.size; i++) {
    const t = r.pick(SHIP_TYPES, (x) => 1 / Math.sqrt(x.price))
    const condition = Math.round(r.range(40, 88))
    const price = Math.round((t.price * (0.25 + 0.6 * (condition / 100)) * r.range(0.9, 1.1)) / 10000) * 10000
    const name = uniqueName(r.pick(USED_NAMES), names)
    names.add(nameKey(name))
    out.push({ id: `${portId}-${month}-${i}`, portId, typeId: t.id, condition, price, name })
  }
  const taken = new Set(state.takenListings)
  return out.filter((l) => !taken.has(l.id))
}

export function sellsNewShips(portId: string): boolean {
  return getPort(portId).size >= NEWBUILD_PORT_SIZE
}

export function canRepairAt(portId: string): boolean {
  return getPort(portId).size >= REPAIR_PORT_SIZE
}

export const SHIPYARD_PORTS = PORTS.filter((p) => p.size >= NEWBUILD_PORT_SIZE).map((p) => p.id)

// ---- actions ----

/** Throws a Finnish error if the name is empty or already used in the fleet. */
export function checkShipName(state: GameState, name: string, exceptShipId?: string) {
  if (!name.trim()) throw new Error('Anna laivalle nimi.')
  if (isNameTaken(state, name, exceptShipId)) throw new Error(`Laivastossa on jo laiva nimeltä ${name.trim()}. Valitse toinen nimi.`)
}

function addShip(s: GameState, t: ShipType, name: string, portId: string, condition: number): OwnedShip {
  const ship: OwnedShip = {
    id: `s${s.nextId++}`,
    name: name.trim().replace(/\s+/g, ' '),
    typeId: t.id,
    portId,
    // Delivered with a third of a tank.
    fuel: Math.round(t.fuelCapacity / 3),
    condition,
    voyage: null,
    dockUntil: null,
    acquiredDay: s.day,
  }
  s.ships.push(ship)
  return ship
}

function pay(s: GameState, amount: number) {
  if (amount > s.money) throw new Error('Kassa ei riitä. Voit ottaa lainaa pankista.')
  s.money -= amount
}

export function buyNewShip(state: GameState, portId: string, typeId: string, name: string): GameState {
  if (!sellsNewShips(portId)) throw new Error('Tässä satamassa ei myydä uusia laivoja.')
  checkShipName(state, name)
  const s = clone(state)
  const t = getShipType(typeId)
  pay(s, t.price)
  const ship = addShip(s, t, name, portId, 100)
  log(s, { kind: 'shipyard', text: `Ostettiin uusi ${t.name.toLowerCase()} ${ship.name} (${getPort(portId).name}).`, amount: -t.price })
  return s
}

export function buyUsedShip(state: GameState, listingId: string, name: string): GameState {
  const portId = listingId.split('-').slice(0, -2).join('-')
  const listing = usedListings(state, portId).find((l) => l.id === listingId)
  if (!listing) throw new Error('Laiva on jo myyty.')
  name = name.trim() || listing.name
  checkShipName(state, name)
  const s = clone(state)
  const t = getShipType(listing.typeId)
  pay(s, listing.price)
  s.takenListings = [...s.takenListings, listing.id]
  const ship = addShip(s, t, name, portId, listing.condition)
  log(s, { kind: 'shipyard', text: `Ostettiin käytetty ${t.name.toLowerCase()} ${ship.name} (${getPort(portId).name}, kunto ${listing.condition} %).`, amount: -listing.price })
  return s
}

export function sellShip(state: GameState, shipId: string): GameState {
  const s = clone(state)
  const ship = getShip(s, shipId)
  if (!ship.portId) throw new Error('Laiva on merellä.')
  if (ship.dockUntil !== null) throw new Error('Laiva on telakalla.')
  if (s.ships.length === 1) throw new Error('Et voi myydä viimeistä laivaasi.')
  const value = shipValue(ship)
  s.money += value
  s.ships = s.ships.filter((x) => x.id !== shipId)
  log(s, { kind: 'shipyard', text: `${ship.name} myytiin (${getPort(ship.portId).name}).`, amount: value })
  return s
}

export function startRepair(state: GameState, shipId: string): GameState {
  const s = clone(state)
  const ship = s.ships.find((x) => x.id === shipId)
  if (!ship?.portId) throw new Error('Laiva on merellä.')
  if (!canRepairAt(ship.portId)) throw new Error('Satamassa ei ole telakkaa.')
  if (ship.dockUntil !== null) throw new Error('Laiva on jo telakalla.')
  const q = repairQuote(ship)
  if (q.points <= 0) throw new Error('Laiva on jo erinomaisessa kunnossa.')
  pay(s, q.cost)
  s.ledger.repairs += q.cost
  ship.dockUntil = s.day + q.days
  log(s, { kind: 'shipyard', text: `${ship.name} telakoitiin korjattavaksi ${q.days} päiväksi (${fmtMoney(q.cost)}).`, amount: -q.cost })
  return s
}

/** Finish repairs that are due today. Mutates `s` (called from advanceDay). */
export function finishRepairs(s: GameState) {
  for (const ship of s.ships) {
    if (ship.dockUntil !== null && s.day >= ship.dockUntil) {
      ship.dockUntil = null
      ship.condition = 100
      log(s, { kind: 'shipyard', text: `${ship.name} on korjattu ja valmis lähtöön.` })
    }
  }
}
