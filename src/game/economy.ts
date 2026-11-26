import { getCanal } from '../data/canals'
import { getPort, PORTS } from '../data/ports'
import { getRoute } from '../data/routes'
import { getShipType, type ShipType } from '../data/shipTypes'
import { portOnStrike } from './news'
import { hashString, rng } from './rng'
import { getShip } from './state'
import type { Contract, GameState, Pace } from './types'

import { MONTH, monthOf } from './calendar'

/** Market and price cycles, in days. */
export { MARKET_WEEK } from './calendar'
export const PRICE_MONTH = MONTH

/** Ships sail a little slower than service speed on average (weather, pilots). */
const SPEED_FACTOR = 0.92

/** Bigger ships pay more in port and canal fees. */
export function sizeFactor(t: ShipType): number {
  return 0.5 + t.capacity / 40000
}

/** Harbour fee for a call; doubled while the port is on strike. */
export function harbourFee(portId: string, t: ShipType, state?: Pick<GameState, 'seed' | 'day'>): number {
  const strike = state && portOnStrike(state, portId) ? 2 : 1
  return Math.round(getPort(portId).harbourFee * sizeFactor(t) * strike)
}

export function canalToll(canalId: string, t: ShipType): number {
  const c = getCanal(canalId)
  return c ? Math.round(c.toll * sizeFactor(t)) : 0
}

/** Big bunkering hubs sell fuel cheaper than elsewhere. */
export const BUNKER_HUBS = new Set(['singapore', 'rotterdam', 'dubai', 'houston', 'panama'])
const HUB_DISCOUNT = 0.8

/** Bunker price in dollars per tonne at a port this month. */
export function fuelPrice(state: Pick<GameState, 'seed' | 'day'>, portId: string): number {
  const p = getPort(portId)
  const base = (100 + (hashString(portId) % 50) - p.size * 5) * (BUNKER_HUBS.has(portId) ? HUB_DISCOUNT : 1)
  const month = monthOf(state.day)
  const swing = rng(hashString(`${state.seed}:fuel:${month}`)).range(0.85, 1.2)
  // Local prices move a lot from month to month, so where to fill up matters.
  const local = rng(hashString(`${state.seed}:fuel:${portId}:${month}`)).range(0.85, 1.2)
  return Math.round(base * swing * local)
}

/** Average bunker price over all ports this month (to tell cheap from dear). */
export function averageFuelPrice(state: Pick<GameState, 'seed' | 'day'>): number {
  return PORTS.reduce((sum, p) => sum + fuelPrice(state, p.id), 0) / PORTS.length
}

/** How a port's fuel compares to the world average this month. */
export function fuelPriceLevel(state: Pick<GameState, 'seed' | 'day'>, portId: string): 'cheap' | 'normal' | 'dear' {
  const r = fuelPrice(state, portId) / averageFuelPrice(state)
  return r < 0.92 ? 'cheap' : r > 1.08 ? 'dear' : 'normal'
}

export type { Pace } from './types'

export interface PaceInfo {
  id: Pace
  label: string
  detail: string
  /** Share of service speed. */
  speed: number
  /** Fuel burn per day compared to service speed (roughly speed cubed). */
  fuel: number
  /** Hull and engine wear compared to service speed. */
  wear: number
}

export const PACES: PaceInfo[] = [
  { id: 'eco', label: 'Säästöajo', detail: 'Hitaampi, mutta polttoainetta kuluu noin 30 % vähemmän matkalla.', speed: 0.85, fuel: 0.61, wear: 0.8 },
  { id: 'normal', label: 'Normaali', detail: 'Laivan tavallinen matkanopeus.', speed: 1, fuel: 1, wear: 1 },
  { id: 'full', label: 'Täysi vauhti', detail: 'Noin 10 % nopeampi, mutta polttoainetta kuluu noin 20 % enemmän ja laiva kuluu nopeammin.', speed: 1.1, fuel: 1.33, wear: 1.5 },
]

export function paceInfo(pace: Pace | undefined): PaceInfo {
  return PACES.find((p) => p.id === (pace ?? 'normal'))!
}

/** A worn hull is slower: at 0 % condition the ship makes 80 % of its speed. */
export function effectiveSpeed(t: ShipType, condition = 100, pace?: Pace): number {
  return t.speed * (0.8 + 0.2 * (condition / 100)) * paceInfo(pace).speed
}

/** A worn engine burns more: up to +40 % at 0 % condition. */
export function effectiveFuelPerDay(t: ShipType, condition = 100, pace?: Pace): number {
  return t.fuelPerDay * (1 + 0.4 * (1 - condition / 100)) * paceInfo(pace).fuel
}

export function sailingDays(nm: number, t: ShipType, condition = 100, pace?: Pace): number {
  return nm / (effectiveSpeed(t, condition, pace) * SPEED_FACTOR * 24)
}

/** Fuel for a voyage including a 10 % reserve, as any sensible captain keeps. */
export function fuelForVoyage(nm: number, t: ShipType, condition = 100, pace?: Pace): number {
  return Math.ceil(sailingDays(nm, t, condition, pace) * effectiveFuelPerDay(t, condition, pace) * 1.1)
}

/** Can the ship make the trip on one tank? */
export function inRange(t: ShipType, nm: number, condition = 100): boolean {
  return fuelForVoyage(nm, t, condition) <= t.fuelCapacity
}

export interface VoyagePlan {
  from: string
  to: string
  nm: number
  canals: string[]
  days: number
  /** Whole days until the ship docks. */
  arriveInDays: number
  fuelNeeded: number
  /** Tonnes to buy before leaving (0 if the tank is enough). */
  fuelToBuy: number
  fuelCost: number
  runningCost: number
  harbourFee: number
  canalTolls: number
  totalCost: number
}

/** What a voyage from the ship's port to `to` would take and cost. */
export function planVoyage(state: GameState, shipId: string, to: string, pace: Pace = 'normal'): VoyagePlan {
  const ship = state.ships.find((s) => s.id === shipId)
  if (!ship?.portId) throw new Error('Laiva ei ole satamassa.')
  const t = getShipType(ship.typeId)
  const route = getRoute(ship.portId, to)
  const days = sailingDays(route.nm, t, ship.condition, pace)
  const arriveInDays = Math.max(1, Math.ceil(days))
  const fuelNeeded = fuelForVoyage(route.nm, t, ship.condition, pace)
  const fuelToBuy = Math.max(0, fuelNeeded - ship.fuel)
  const fuelCost = Math.round(fuelToBuy * fuelPrice(state, ship.portId))
  const runningCost = Math.round(arriveInDays * t.dailyCost)
  const fee = harbourFee(to, t, state)
  const canalTolls = route.canals.reduce((s, c) => s + canalToll(c, t), 0)
  return {
    from: ship.portId,
    to,
    nm: route.nm,
    canals: route.canals,
    days,
    arriveInDays,
    fuelNeeded,
    fuelToBuy,
    fuelCost,
    runningCost,
    harbourFee: fee,
    canalTolls,
    totalCost: fuelCost + runningCost + fee + canalTolls,
  }
}

/** Fuel burned on a voyage (without the reserve), as valued at today's price at the start port. */
export function voyageFuelValue(state: GameState, shipId: string, to: string, pace: Pace = 'normal'): number {
  const ship = getShip(state, shipId)
  if (!ship.portId) throw new Error('Laiva ei ole satamassa.')
  const t = getShipType(ship.typeId)
  const days = sailingDays(getRoute(ship.portId, to).nm, t, ship.condition, pace)
  return Math.round(days * effectiveFuelPerDay(t, ship.condition, pace) * fuelPrice(state, ship.portId))
}

/** Daily contract penalty as a share of the freight pay. */
export const PENALTY_RATE = 0.05
export const EXPRESS_PENALTY_RATE = 0.1

/** Contract penalty per day late, dollars. */
export function penaltyPerDay(c: Pick<Contract, 'pay' | 'express' | 'penaltyPerDay'>): number {
  if (c.penaltyPerDay !== undefined) return c.penaltyPerDay
  return Math.round((c.pay * (c.express ? EXPRESS_PENALTY_RATE : PENALTY_RATE)) / 100) * 100
}

/** Total contract penalty for a delivery `daysLate` days late. Never more than the freight pay. */
export function latePenalty(c: Pick<Contract, 'pay' | 'express' | 'penaltyPerDay'>, daysLate: number): number {
  if (daysLate <= 0) return 0
  return Math.min(c.pay, daysLate * penaltyPerDay(c))
}
