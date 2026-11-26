import { getCanal } from '../data/canals'
import { getPort } from '../data/ports'
import { getShipType } from '../data/shipTypes'
import { effectiveFuelPerDay, fuelPrice, harbourFee, latePenalty, paceInfo, penaltyPerDay, planVoyage, sizeFactor, type Pace } from './economy'
import { hashString, rng } from './rng'
import { fmtMoney, fmtNum } from './format'
import { getCargo, marketWeek, offerFits, portOffers } from './market'
import { monthEnd } from './bank'
import { resolveEvent, rollSeaEvents } from './events'
import { MONTH, monthOf } from './calendar'
import { finishRepairs } from './fleet'
import { captainDayAtSea, captainMods, shipDailyCost } from './captains'
import { checkMilestones } from './milestones'
import { BROKER_FEE, runOrders } from './orders'
import { monthNews } from './news'
import { addLog as log, clone, getShip as shipOf } from './state'
import type { Contract, GameState, OwnedShip } from './types'
import { sailingTime } from './voyage'
import { closeYear } from './yearReview'
import { portOpen, timelineNews } from './timeline'

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
export function depart(state: GameState, shipId: string, to: string, contract: Contract | null = null, pace: Pace = 'normal'): GameState {
  if (!portOpen(getPort(to), state.day)) throw new Error('Satama ei ole vielä avoinna.')
  const plan = planVoyage(state, shipId, to, pace)
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
  if (pace !== 'normal') ship.voyage.pace = pace
  if (ship.orders) delete ship.orders.waitingSince
  ship.portId = null
  for (const c of plan.canals) {
    if (!s.stats.canalsUsed.includes(c)) s.stats.canalsUsed = [...s.stats.canalsUsed, c]
    const toll = Math.round(plan.canalTolls / plan.canals.length)
    s.money -= toll
    s.ledger.canal += toll
    log(s, { kind: 'info', text: `${ship.name}: ${getCanal(c)?.name ?? c}, kanavamaksu.`, amount: -toll })
  }
  const what = contract ? `${fmtNum(contract.tonnes)} t ${getCargo(contract.cargoId).name.toLowerCase()}` : 'ilman lastia'
  const how = pace === 'normal' ? '' : ` (${paceInfo(pace).label.toLowerCase()})`
  log(s, {
    kind: 'departure',
    text: `${ship.name} lähti${how}: ${getPort(plan.from).name} → ${getPort(to).name}, ${what}. Perillä noin ${plan.arriveInDays} päivässä.`,
  })
  return s
}

/** Accept a freight offer at the ship's port and sail at once. */
export function acceptOffer(state: GameState, shipId: string, offerId: string, pace: Pace = 'normal'): GameState {
  const ship = shipOf(state, shipId)
  if (!ship.portId) throw new Error('Laiva on merellä.')
  const offer = portOffers(state, ship.portId).find((o) => o.id === offerId)
  if (!offer) throw new Error('Tarjous ei ole enää voimassa.')
  return depart(state, shipId, offer.to, offer, pace)
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
    running += shipDailyCost(ship)
    if (ship.dockUntil !== null) running -= t.dailyCost / 2 // crew partly ashore while in dock
    if (!ship.voyage) continue
    // Burn only for the part of the day actually spent sailing.
    const sailed = sailingTime(ship.voyage, s.day - 1, s.day)
    const pace = ship.voyage.pace
    const m = captainMods(ship)
    ship.fuel = Math.max(0, Math.round((ship.fuel - effectiveFuelPerDay(t, ship.condition, pace, m) * sailed) * 10) / 10)
    ship.condition = Math.max(0, Math.round((ship.condition - WEAR_PER_DAY * paceInfo(pace).wear * m.wear) * 100) / 100)
    if (sailed > 0) captainDayAtSea(s, ship)
    if (s.day >= ship.voyage.arriveDay) arrive(s, ship)
  }
  s.money -= running
  s.ledger.running += running
  finishRepairs(s)
  rollSeaEvents(s)
  // Captains decide on their own: the first option is always the safe one.
  const decided = s.pendingEvent && s.settings.autoEvents ? resolveEvent(s, s.pendingEvent.options[0].id) : s
  // Ships under standing orders pick their next job.
  const out = runOrders(decided)
  return finishDay(out, state.money)
}

function finishDay(s: GameState, moneyBefore: number): GameState {
  if (s.day % MONTH === 0) for (const n of monthNews(s, s.day / MONTH)) log(s, { kind: 'news', text: n.text })
  for (const text of timelineNews(s.day)) log(s, { kind: 'news', text })

  if (moneyBefore >= 0 && s.money < 0) {
    log(s, { kind: 'warning', text: 'Kassa on miinuksella! Kuun lopussa pankki kattaa vajeen lainalla, jos luottoa on jäljellä.' })
  }
  monthEnd(s)
  closeYear(s)
  checkMilestones(s)
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
  if (!s.stats.portsVisited.includes(port.id)) s.stats.portsVisited = [...s.stats.portsVisited, port.id]
  portInspection(s, ship)
  const c = v.contract
  if (!c) return
  const late = s.day - c.deadlineDay
  const pay = Math.round(c.pay * (v.payFactor ?? 1))
  s.money += pay
  s.ledger.revenue += pay
  ship.earned = (ship.earned ?? 0) + pay - latePenalty(c, late)
  if (ship.orders) {
    const fee = Math.round(c.pay * BROKER_FEE)
    s.money -= fee
    s.ledger.running += fee
    ship.earned -= fee
    log(s, { kind: 'info', text: `Rahtimeklarin palkkio (${Math.round(BROKER_FEE * 100)} %, automaattiohjaus).`, amount: -fee })
  }
  const bonus = Math.round(pay * captainMods(ship).payBonus)
  if (bonus > 0) {
    s.money += bonus
    s.ledger.revenue += bonus
    ship.earned += bonus
    log(s, { kind: 'delivery', text: `Kapteeni ${ship.captain!.name} neuvotteli lisämaksun.`, amount: bonus })
  }
  const st = s.stats
  st.deliveries += 1
  st.tonnes += c.tonnes
  if (late > 0) st.onTimeStreak = 0
  else {
    st.onTime += 1
    st.onTimeStreak += 1
    if (c.express) st.expressOnTime += 1
  }
  if (v.rush) {
    if (s.day <= v.rush.byDay) {
      s.money += v.rush.bonus
      s.ledger.awards += v.rush.bonus
      ship.earned += v.rush.bonus
      log(s, { kind: 'award', text: `${ship.name} ehti luvattuun aikaan. Vastaanottaja maksoi kiirebonuksen.`, amount: v.rush.bonus })
    } else {
      log(s, { kind: 'late', text: `${ship.name} ei ehtinyt luvattuun aikaan, joten kiirebonus jäi saamatta.` })
    }
  }
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

/** Worn below this, port state control may fine the ship on arrival. */
export const INSPECTION_BELOW = 50
export const P_INSPECTION_FINE = 0.5

/** Port state control: a badly worn ship risks a fine when it docks. Mutates `s`. */
function portInspection(s: GameState, ship: OwnedShip) {
  if (ship.condition >= INSPECTION_BELOW) return
  const r = rng(hashString(`${s.seed}:inspect:${ship.id}:${s.day}`))
  if (r.next() >= P_INSPECTION_FINE) return
  const fine = Math.round((25_000 * sizeFactor(getShipType(ship.typeId))) / 1000) * 1000
  s.money -= fine
  s.ledger.incidents += fine
  log(s, {
    kind: 'warning',
    text: `Satamavaltion tarkastajat löysivät laivasta ${ship.name} puutteita (kunto ${Math.round(ship.condition)} %). Sakko. Korjaa laiva telakalla.`,
    amount: -fine,
  })
}

/** Ships that docked between two states (for pausing / notifications). */
export function arrivals(before: GameState, after: GameState): OwnedShip[] {
  return after.ships.filter((s) => s.portId && before.ships.find((b) => b.id === s.id)?.voyage)
}

export interface IdleNotice {
  shipId: string
  /** arrived / repaired: the ship just became free. offers: it was already waiting and the port's freight board renewed. */
  reason: 'arrived' | 'repaired' | 'offers'
}

/** Ships that wait in port for orders and need the player's attention after this step. */
export function newlyIdle(before: GameState, after: GameState): IdleNotice[] {
  const out: IdleNotice[] = []
  const boardChanged = marketWeek(before.day) !== marketWeek(after.day) || monthOf(before.day) !== monthOf(after.day)
  const renewed = new Map<string, boolean>()
  for (const s of after.ships) {
    const b = before.ships.find((x) => x.id === s.id)
    if (!b || s.voyage || s.dockUntil !== null || !s.portId) continue
    // Ships under standing orders look after themselves.
    if (s.orders) continue
    if (b.voyage) out.push({ shipId: s.id, reason: 'arrived' })
    else if (b.dockUntil !== null) out.push({ shipId: s.id, reason: 'repaired' })
    else if (boardChanged && b.portId === s.portId) {
      let fresh = renewed.get(s.portId)
      if (fresh === undefined) {
        fresh = newOffers(before, after, s.portId).length > 0
        renewed.set(s.portId, fresh)
      }
      if (fresh) out.push({ shipId: s.id, reason: 'offers' })
    }
  }
  return out
}

/** Offers on a port's board after a step that were not there before it (a new week, or a strike that ended). */
export function newOffers(before: GameState, after: GameState, portId: string): Contract[] {
  const old = new Set(portOffers(before, portId).map((o) => o.id))
  return portOffers(after, portId).filter((o) => !old.has(o.id))
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
