import { getCanal } from '../data/canals'
import { getPort } from '../data/ports'
import { getShipType } from '../data/shipTypes'
import { fuelPrice, harbourFee, latePay, planVoyage } from './economy'
import { fmtMoney, fmtNum } from './format'
import { getCargo, marketWeek, offerFits, portOffers } from './market'
import type { Contract, GameState, LogEntry, OwnedShip } from './types'

// All game rules that change state live here. Each function returns a new
// state (the old one is never mutated), so React re-renders and autosave work.

const LOG_LIMIT = 80
/** Wear per day at sea, condition points. */
const WEAR_PER_DAY = 0.08

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function log(s: GameState, e: Omit<LogEntry, 'day'>) {
  s.log = [{ day: s.day, ...e }, ...s.log].slice(0, LOG_LIMIT)
}

function shipOf(s: GameState, id: string): OwnedShip {
  const ship = s.ships.find((x) => x.id === id)
  if (!ship) throw new Error('Tuntematon laiva.')
  return ship
}

/** Fill the tank at the current port. */
export function refuel(state: GameState, shipId: string, tonnes?: number): GameState {
  const s = clone(state)
  const ship = shipOf(s, shipId)
  if (!ship.portId) throw new Error('Laiva on merellä.')
  const t = getShipType(ship.typeId)
  const amount = Math.max(0, Math.min(tonnes ?? Infinity, t.fuelCapacity - ship.fuel))
  const cost = Math.round(amount * fuelPrice(s, ship.portId))
  if (amount <= 0) return state
  ship.fuel += amount
  s.money -= cost
  s.ledger.fuel += cost
  log(s, { kind: 'info', text: `${ship.name} tankkasi ${fmtNum(amount)} t polttoainetta: ${getPort(ship.portId).name}.`, amount: -cost })
  return s
}

/** Send a ship to `to`, optionally carrying a contract. Buys missing fuel automatically. */
export function depart(state: GameState, shipId: string, to: string, contract: Contract | null = null): GameState {
  const plan = planVoyage(state, shipId, to)
  const t = getShipType(shipOf(state, shipId).typeId)
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
  const s = clone(state)
  const prevWeek = marketWeek(s.day)
  s.day += 1
  if (marketWeek(s.day) !== prevWeek) s.takenOffers = []

  let running = 0
  for (const ship of s.ships) {
    const t = getShipType(ship.typeId)
    running += t.dailyCost
    if (!ship.voyage) continue
    // Burn only for the part of the day actually spent sailing.
    const sailed = Math.min(1, ship.voyage.arriveDay - (s.day - 1))
    ship.fuel = Math.max(0, Math.round((ship.fuel - t.fuelPerDay * sailed) * 10) / 10)
    ship.condition = Math.max(0, Math.round((ship.condition - WEAR_PER_DAY) * 100) / 100)
    if (s.day >= ship.voyage.arriveDay) arrive(s, ship)
  }
  s.money -= running
  s.ledger.running += running

  if (state.money >= 0 && s.money < 0) {
    log(s, { kind: 'warning', text: 'Kassa on miinuksella! Hanki tuloja pian.' })
  }
  return s
}

function arrive(s: GameState, ship: OwnedShip) {
  const v = ship.voyage!
  const t = getShipType(ship.typeId)
  const port = getPort(v.to)
  ship.portId = v.to
  ship.voyage = null
  const fee = harbourFee(port.id, t)
  s.money -= fee
  s.ledger.harbour += fee
  log(s, { kind: 'arrival', text: `${ship.name} saapui satamaan ${port.name}. Satamamaksu.`, amount: -fee })
  const c = v.contract
  if (!c) return
  const late = s.day - c.deadlineDay
  const pay = latePay(c.pay, late)
  s.money += pay
  s.ledger.revenue += pay
  const cargo = getCargo(c.cargoId).name.toLowerCase()
  if (late > 0) {
    log(s, { kind: 'late', text: `${ship.name} toimitti ${cargo} ${late} pv myöhässä. Maksu pieneni (${fmtMoney(c.pay)} → ${fmtMoney(pay)}).`, amount: pay })
  } else {
    log(s, { kind: 'delivery', text: `${ship.name} toimitti ${fmtNum(c.tonnes)} t ${cargo} ajallaan.`, amount: pay })
  }
}

/** Ships that docked between two states (for pausing / notifications). */
export function arrivals(before: GameState, after: GameState): OwnedShip[] {
  return after.ships.filter((s) => s.portId && before.ships.find((b) => b.id === s.id)?.voyage)
}
