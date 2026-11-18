import { getCanal } from '../data/canals'
import { getPort } from '../data/ports'
import { getRoute } from '../data/routes'
import { getShipType, type ShipType } from '../data/shipTypes'
import { hashString, rng } from './rng'
import type { GameState, OwnedShip } from './types'

/** Market and price cycles, in days. */
export const MARKET_WEEK = 7
export const PRICE_MONTH = 30

/** Ships sail a little slower than service speed on average (weather, pilots). */
const SPEED_FACTOR = 0.92

/** Bigger ships pay more in port and canal fees. */
export function sizeFactor(t: ShipType): number {
  return 0.5 + t.capacity / 40000
}

export function harbourFee(portId: string, t: ShipType): number {
  return Math.round(getPort(portId).harbourFee * sizeFactor(t))
}

export function canalToll(canalId: string, t: ShipType): number {
  const c = getCanal(canalId)
  return c ? Math.round(c.toll * sizeFactor(t)) : 0
}

/** Bunker price in dollars per tonne at a port this month. */
export function fuelPrice(state: Pick<GameState, 'seed' | 'day'>, portId: string): number {
  const p = getPort(portId)
  const base = 105 + (hashString(portId) % 40) - p.size * 4
  const month = Math.floor(state.day / PRICE_MONTH)
  const swing = rng(hashString(`${state.seed}:fuel:${month}`)).range(0.85, 1.2)
  const local = rng(hashString(`${state.seed}:fuel:${portId}:${month}`)).range(0.95, 1.05)
  return Math.round(base * swing * local)
}

/** A worn hull is slower: at 0 % condition the ship makes 80 % of its speed. */
export function effectiveSpeed(t: ShipType, condition = 100): number {
  return t.speed * (0.8 + 0.2 * (condition / 100))
}

/** A worn engine burns more: up to +40 % at 0 % condition. */
export function effectiveFuelPerDay(t: ShipType, condition = 100): number {
  return t.fuelPerDay * (1 + 0.4 * (1 - condition / 100))
}

export function sailingDays(nm: number, t: ShipType, condition = 100): number {
  return nm / (effectiveSpeed(t, condition) * SPEED_FACTOR * 24)
}

/** Fuel for a voyage including a 10 % reserve, as any sensible captain keeps. */
export function fuelForVoyage(nm: number, t: ShipType, condition = 100): number {
  return Math.ceil(sailingDays(nm, t, condition) * effectiveFuelPerDay(t, condition) * 1.1)
}

/** Can the ship make the trip on one tank? */
export function inRange(t: ShipType, nm: number, condition = 100): boolean {
  return fuelForVoyage(nm, t, condition) <= t.fuelCapacity
}

export function shipFor(state: GameState, id: string): OwnedShip {
  const s = state.ships.find((x) => x.id === id)
  if (!s) throw new Error('Tuntematon laiva.')
  return s
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
export function planVoyage(state: GameState, shipId: string, to: string): VoyagePlan {
  const ship = state.ships.find((s) => s.id === shipId)
  if (!ship?.portId) throw new Error('Laiva ei ole satamassa.')
  const t = getShipType(ship.typeId)
  const route = getRoute(ship.portId, to)
  const days = sailingDays(route.nm, t, ship.condition)
  const arriveInDays = Math.max(1, Math.ceil(days))
  const fuelNeeded = fuelForVoyage(route.nm, t, ship.condition)
  const fuelToBuy = Math.max(0, fuelNeeded - ship.fuel)
  const fuelCost = Math.round(fuelToBuy * fuelPrice(state, ship.portId))
  const runningCost = Math.round(arriveInDays * t.dailyCost)
  const fee = harbourFee(to, t)
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
export function voyageFuelValue(state: GameState, shipId: string, to: string): number {
  const ship = state.ships.find((s) => s.id === shipId)!
  const t = getShipType(ship.typeId)
  const days = sailingDays(getRoute(ship.portId!, to).nm, t, ship.condition)
  return Math.round(days * effectiveFuelPerDay(t, ship.condition) * fuelPrice(state, ship.portId!))
}

/** Pay after a late delivery: −10 % per day late, at least 30 %. */
export function latePay(pay: number, daysLate: number): number {
  if (daysLate <= 0) return pay
  return Math.round(pay * Math.max(0.3, 1 - 0.1 * daysLate))
}
