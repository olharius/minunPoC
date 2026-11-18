import { getCanal } from '../data/canals'
import { getPort } from '../data/ports'
import { getShipType } from '../data/shipTypes'
import { effectiveFuelPerDay, fuelPrice, harbourFee, latePenalty, penaltyPerDay, planVoyage } from './economy'
import { fmtMoney, fmtNum } from './format'
import { getCargo, marketWeek, offerFits, portOffers } from './market'
import { monthEnd } from './bank'
import { resolveEvent, rollSeaEvents } from './events'
import { MONTH } from './calendar'
import { finishRepairs } from './fleet'
import { monthNews } from './news'
import { addLog as log, clone, getShip as shipOf } from './state'
import type { Contract, GameState, OwnedShip } from './types'
import { sailingTime } from './voyage'

// All game rules that change state live here. Each function returns a new
// state (the old one is never mutated), so React re-renders and autosave work.

/** Wear per day at sea, condition points. */
const WEAR_PER_DAY = 0.08

/** Fill the tank at the current port. */
export function refuel(state: GameState, shipId: string, tonnes?: number): GameState {
  const s = clone(state)
  const ship = shipOf(s, shipId)
  if (!ship.portId) throw new Error('Laiva on merellä.')
  const t = getShipType(ship.typeId)
  const amount = Math.max(0, Math.min(tonnes ?? Infinity, t.fuelCapacity - ship.fuel))
  if (amount <= 0) return state
  const cost = Math.round(amount * fuelPrice(s, ship.portId))
  ship.fuel += amount
  s.money -= cost
  s.ledger.fuel += cost
  log(s, { kind: 'info', text: `${ship.name} tankkasi ${fmtNum(amount)} t polttoainetta: ${getPort(ship.portId).name}.`, amount: -cost })
  return s
}

/** Send a ship to `to`, optionally carrying a contract. Buys missing fuel automatically. */
export function depart(state: GameState, shipId: string, to: string, contract: Contract | null = null): GameState {
  const plan = planVoyage(state, shipId, to)
  const before = shipOf(state, shipId)
  const t = getShipType(before.typeId)
  if (before.dockUntil !== null) throw new Error('Laiva on telakalla.')
  if (plan.fuelNeeded > t.fuelCapacity) throw new Error('Matka on liian pitkä yhdellä tankillisella.')
  let s = state
  if (plan.fuelToBuy > 0) s = refuel(s, shipId, plan.fuelToBuy)
  s = clone(s)
  const ship = shipOf(s, shipId)
  if (contract) {
    const fit = offerFits(ship, t, contract)
    if (fit) throw new Error(fit)
    if (contract.from !== ship.portId || contract.to !== to) throw new Error('Rahti ei sovi tälle matkalle.')
    s.takenOffers = [...s.takenOffers, contract.id]
  }
  ship.voyage = { from: ship.portId!, to, departDay: s.day, arriveDay: s.day + plan.days, contract }
  ship.portId = null
  for (const c of plan.canals) {
    const toll = Math.round(plan.canalTolls / plan.canals.length)
    s.money -= toll
    s.ledger.canal += toll
    log(s, { kind: 'info', text: `${ship.name}: ${getCanal(c)?.name ?? c}, kanavamaksu.`, amount: -toll })
  }
  const what = contract ? `${fmtNum(contract.tonnes)} t ${getCargo(contract.cargoId).name.toLowerCase()}` : 'ilman lastia'
  log(s, {
    kind: 'departure',
    text: `${ship.name} lähti: ${getPort(plan.from).name} → ${getPort(to).name}, ${what}. Perillä noin ${plan.arriveInDays} päivässä.`,
  })
  return s
}

/** Accept a freight offer at the ship's port and sail at once. */
export function acceptOffer(state: GameState, shipId: string, offerId: string): GameState {
  const ship = shipOf(state, shipId)
  if (!ship.portId) throw new Error('Laiva on merellä.')
  const offer = portOffers(state, ship.portId).find((o) => o.id === offerId)
  if (!offer) throw new Error('Tarjous ei ole enää voimassa.')
  return depart(state, shipId, offer.to, offer)
}

/** Advance the clock one day: costs, fuel, wear, arrivals. */
export function advanceDay(state: GameState): GameState {
  if (state.bankrupt) return state
  const s = clone(state)
  const prevWeek = marketWeek(s.day)
  s.day += 1
  if (marketWeek(s.day) !== prevWeek) s.takenOffers = []
  if (s.day % MONTH === 0) s.takenListings = []

  let running = 0
  for (const ship of s.ships) {
    const t = getShipType(ship.typeId)
    running += t.dailyCost
    if (ship.dockUntil !== null) running -= t.dailyCost / 2 // crew partly ashore while in dock
    if (!ship.voyage) continue
    // Burn only for the part of the day actually spent sailing.
    const sailed = sailingTime(ship.voyage, s.day - 1, s.day)
    ship.fuel = Math.max(0, Math.round((ship.fuel - effectiveFuelPerDay(t, ship.condition) * sailed) * 10) / 10)
    ship.condition = Math.max(0, Math.round((ship.condition - WEAR_PER_DAY) * 100) / 100)
    if (s.day >= ship.voyage.arriveDay) arrive(s, ship)
  }
  s.money -= running
  s.ledger.running += running
  finishRepairs(s)
  rollSeaEvents(s)
  // Captains decide on their own: the first option is always the safe one.
  const out = s.pendingEvent && s.settings.autoEvents ? resolveEvent(s, s.pendingEvent.options[0].id) : s
  return finishDay(out, state.money)
}

function finishDay(s: GameState, moneyBefore: number): GameState {
  if (s.day % MONTH === 0) for (const n of monthNews(s, s.day / MONTH)) log(s, { kind: 'news', text: n.text })

  if (moneyBefore >= 0 && s.money < 0) {
    log(s, { kind: 'warning', text: 'Kassa on miinuksella! Kuun lopussa pankki kattaa vajeen lainalla, jos luottoa on jäljellä.' })
  }
  monthEnd(s)
  return s
}

function arrive(s: GameState, ship: OwnedShip) {
  const v = ship.voyage!
  const t = getShipType(ship.typeId)
  const port = getPort(v.to)
  ship.portId = v.to
  ship.voyage = null
  const fee = harbourFee(port.id, t, s)
  s.money -= fee
  s.ledger.harbour += fee
  log(s, { kind: 'arrival', text: `${ship.name} saapui satamaan ${port.name}. Satamamaksu.`, amount: -fee })
  const c = v.contract
  if (!c) return
  const late = s.day - c.deadlineDay
  const pay = Math.round(c.pay * (v.payFactor ?? 1))
  s.money += pay
  s.ledger.revenue += pay
  const cargo = getCargo(c.cargoId).name.toLowerCase()
  const kind = c.express ? 'Express-rahti: ' : ''
  if (late > 0) {
    log(s, { kind: 'delivery', text: `${kind}${ship.name} toimitti ${fmtNum(c.tonnes)} t ${cargo} ${late} pv myöhässä.`, amount: pay })
    const penalty = latePenalty(c, late)
    s.money -= penalty
    s.ledger.penalties += penalty
    const capped = penalty < late * penaltyPerDay(c) ? ' (enintään koko rahtimaksu)' : ''
    log(s, { kind: 'late', text: `Sopimussakko: ${late} pv × ${fmtMoney(penaltyPerDay(c))}${capped}.`, amount: -penalty })
  } else {
    log(s, { kind: 'delivery', text: `${kind}${ship.name} toimitti ${fmtNum(c.tonnes)} t ${cargo} ajallaan.`, amount: pay })
  }
}

/** Ships that docked between two states (for pausing / notifications). */
export function arrivals(before: GameState, after: GameState): OwnedShip[] {
  return after.ships.filter((s) => s.portId && before.ships.find((b) => b.id === s.id)?.voyage)
}

export interface IdleNotice {
  shipId: string
  reason: 'arrived' | 'repaired'
}

/** Ships that were busy (at sea or in dock) before this step and now wait in port for orders. */
export function newlyIdle(before: GameState, after: GameState): IdleNotice[] {
  const out: IdleNotice[] = []
  for (const s of after.ships) {
    const b = before.ships.find((x) => x.id === s.id)
    if (!b || s.voyage || s.dockUntil !== null || !s.portId) continue
    if (b.voyage) out.push({ shipId: s.id, reason: 'arrived' })
    else if (b.dockUntil !== null) out.push({ shipId: s.id, reason: 'repaired' })
  }
  return out
}

export interface DockingResult {
  /** Reached the berth before time ran out. */
  success: boolean
  /** Collisions with quays or breakwaters. */
  hits: number
}

/** Outcome of steering a ship into port yourself: a saved pilot fee, or dents. */
export function applyDocking(state: GameState, shipId: string, result: DockingResult): GameState {
  const s = clone(state)
  const ship = shipOf(s, shipId)
  if (!ship.portId) return state
  const t = getShipType(ship.typeId)
  if (result.hits > 0) {
    ship.condition = Math.max(0, ship.condition - 2 * result.hits)
  }
  if (result.success && result.hits === 0) {
    const saved = Math.round(harbourFee(ship.portId, t, s) * 0.4)
    s.money += saved
    s.ledger.harbour -= saved
    log(s, { kind: 'arrival', text: `${ship.name} ohjattiin laituriin ilman luotsia. Luotsimaksu säästyi.`, amount: saved })
  } else if (result.success) {
    log(s, { kind: 'arrival', text: `${ship.name} pääsi laituriin, mutta kolhi itseään (kunto −${2 * result.hits} %).` })
  } else {
    log(s, { kind: 'arrival', text: `${ship.name} ei päässyt laituriin ajoissa, joten luotsi ohjasi sen perille${result.hits ? ` (kunto −${2 * result.hits} %)` : ''}.` })
  }
  return s
}
