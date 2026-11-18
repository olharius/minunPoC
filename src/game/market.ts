import { CARGO_TYPES, type CargoType } from '../data/cargoTypes'
import { getPort, PORTS } from '../data/ports'
import { getRoute } from '../data/routes'
import type { CargoClass, ShipType } from '../data/shipTypes'
import { MARKET_WEEK, monthOf } from './calendar'
import { inRange, penaltyPerDay } from './economy'
import { cargoFactor, portOnStrike } from './news'
import { hashString, rng } from './rng'
import type { Contract, GameState, OwnedShip } from './types'

/** Which cargo a ship of each class can load. */
const LOADS: Record<CargoClass, CargoClass[]> = {
  general: ['general', 'container'],
  container: ['container'],
  bulk: ['bulk'],
  liquid: ['liquid'],
}

/** Typical lot sizes in tonnes. */
const LOT: Record<CargoClass, [number, number]> = {
  general: [1500, 14000],
  container: [1500, 40000],
  bulk: [8000, 65000],
  liquid: [8000, 95000],
}

/** Roughly one offer in five is an express job. */
const EXPRESS_SHARE = 0.2

/** Share of offers per cargo class (small ships should always find work). */
const CLASS_WEIGHT: Record<CargoClass, number> = { general: 3, container: 2.5, bulk: 2.5, liquid: 2 }

export function canLoad(ship: ShipType, cargo: CargoType): boolean {
  return LOADS[ship.cargoClass].includes(cargo.cargoClass)
}

const cargoById = new Map(CARGO_TYPES.map((c) => [c.id, c]))

export function getCargo(id: string): CargoType {
  const c = cargoById.get(id)
  if (!c) throw new Error(`Tuntematon lasti: ${id}`)
  return c
}

export function marketWeek(day: number): number {
  return Math.floor(day / MARKET_WEEK)
}

/** Day the current market week ends (offers refresh then). */
export function nextMarketDay(day: number): number {
  return (marketWeek(day) + 1) * MARKET_WEEK
}

/** Freight rate in dollars for a lot. Longer hauls are cheaper per mile. */
export function freightPay(cargo: CargoType, tonnes: number, nm: number, factor = 1): number {
  const perTonne = cargo.ratePer1000nm * 1.6 * Math.pow(nm / 1000, 0.85) + 6
  return Math.round((tonnes * perTonne * factor) / 100) * 100
}

/** The offers on the board at a port this week, minus ones already taken. */
export function portOffers(state: GameState, portId: string): Contract[] {
  if (portOnStrike(state, portId)) return []
  const taken = new Set(state.takenOffers)
  // Copies, so nothing outside can change the cached board.
  return weekBoard(state, portId)
    .filter((o) => !taken.has(o.id))
    .map((o) => ({ ...o }))
}

// The board is drawn from the seed, so the same week always gives the same
// offers. The screen asks for it on every animation frame while the clock
// runs, so each board is drawn once and remembered. Offers also depend on
// the month's news, hence the month in the key.
const boardCache = new Map<string, readonly Contract[]>()
const BOARD_CACHE_SIZE = 64

function weekBoard(state: Pick<GameState, 'seed' | 'day'>, portId: string): readonly Contract[] {
  const key = `${state.seed}:${portId}:${marketWeek(state.day)}:${monthOf(state.day)}`
  let board = boardCache.get(key)
  if (!board) {
    board = drawBoard(state, portId)
    if (boardCache.size >= BOARD_CACHE_SIZE) boardCache.delete(boardCache.keys().next().value!)
    boardCache.set(key, board)
  }
  return board
}

function drawBoard(state: Pick<GameState, 'seed' | 'day'>, portId: string): readonly Contract[] {
  const week = marketWeek(state.day)
  const port = getPort(portId)
  const r = rng(hashString(`${state.seed}:market:${portId}:${week}`))
  const count = 3 + port.size * 3
  const startDay = week * MARKET_WEEK
  const offers: Contract[] = []
  const dests = PORTS.filter((p) => p.id !== portId)

  // Every board starts with two regional general-cargo jobs, so a small ship always finds work.
  const regional = dests.filter((p) => getRoute(portId, p.id).nm < 5000)
  for (let i = 0; i < count; i++) {
    const starter = i < 2 && regional.length > 0
    const cls = starter ? 'general' : r.pick(Object.keys(CLASS_WEIGHT) as CargoClass[], (c) => CLASS_WEIGHT[c])
    const cargo = r.pick(CARGO_TYPES.filter((c) => c.cargoClass === cls))
    const dest = r.pick(starter ? regional : dests, (p) => p.size * p.size)
    const nm = getRoute(portId, dest.id).nm
    const [lo, hi] = starter ? [1500, 6000] : LOT[cls]
    // Skewed towards smaller lots; big lots are rarer.
    const tonnes = Math.round((lo + (hi - lo) * r.next() ** 1.6) / 100) * 100
    const express = !starter && r.next() < EXPRESS_SHARE
    const rate = r.range(0.85, 1.25) * (0.9 + port.size * 0.05) * cargoFactor(state, cargo.id)
    const pay = freightPay(cargo, tonnes, nm, express ? rate * r.range(1.4, 1.7) : rate)
    const deadlineDay = express
      ? // Only a few days' slack for a 14-knot ship that leaves at once.
        startDay + Math.ceil(nm / (14 * 0.92 * 24)) + r.int(2, 5)
      : // Enough time for a 12-knot ship plus slack.
        startDay + Math.ceil((nm / (12 * 24)) * 1.4) + r.int(6, 14)
    const c: Contract = { id: `${portId}-${week}-${i}`, cargoId: cargo.id, tonnes, from: portId, to: dest.id, pay, deadlineDay }
    if (express) c.express = true
    c.penaltyPerDay = penaltyPerDay(c)
    offers.push(c)
  }
  return offers.sort((a, b) => b.pay - a.pay)
}

export function offerFits(ship: OwnedShip, t: ShipType, o: Contract): string | null {
  if (!canLoad(t, getCargo(o.cargoId))) return 'Väärä laivatyyppi'
  if (o.tonnes > t.capacity) return 'Ei mahdu'
  if (ship.voyage) return 'Laiva on merellä'
  if (!inRange(t, getRoute(o.from, o.to).nm, ship.condition)) return 'Liian pitkä matka'
  if (ship.dockUntil !== null) return 'Laiva on telakalla'
  return null
}
