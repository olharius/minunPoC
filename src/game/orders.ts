import { getPort, PORTS } from '../data/ports'
import { getRoute } from '../data/routes'
import { getShipType } from '../data/shipTypes'
import { MARKET_WEEK } from './calendar'
import { fuelForVoyage, voyageEstimate } from './economy'
import { captainMods } from './captains'
import { canRepairAt, repairQuote, startRepair } from './fleet'
import { portOpen } from './timeline'
import { offerFits, portOffers } from './market'
import { depart } from './sim'
import { addLog as log, clone, getShip } from './state'
import type { Contract, GameState, OwnedShip, ShipOrders } from './types'

// Standing orders: a ship that waits in port picks the freight that earns the
// most per day inside its area, sails empty back into the area when it is
// outside it, and goes to dry dock by itself when worn.

/** A freight broker finds the jobs for automated ships and takes this share of the pay. */
export const BROKER_FEE = 0.05

/** Worn below this, a ship with auto-repair goes to dry dock. */
export const AUTO_REPAIR_BELOW = 60

export function inArea(o: Pick<ShipOrders, 'regions'>, portId: string): boolean {
  return o.regions.length === 0 || o.regions.includes(getPort(portId).region)
}

export function setOrders(state: GameState, shipId: string, orders: ShipOrders | null): GameState {
  const s = clone(state)
  const ship = getShip(s, shipId)
  if (orders) {
    ship.orders = { regions: [...orders.regions], pace: orders.pace, autoRepair: orders.autoRepair }
    log(s, { kind: 'info', text: `${ship.name} siirtyi automaattiohjaukseen.` })
  } else {
    delete ship.orders
    log(s, { kind: 'info', text: `${ship.name} palasi käsiohjaukseen.` })
  }
  // Start at once if the ship is waiting in port.
  return runOrders(s)
}

export interface OrderChoice {
  contract: Contract
  profit: number
  perDay: number
}

/** The best offer at the ship's port for its orders: on time, inside the area, earning the most per day. */
export function bestOffer(s: GameState, ship: OwnedShip, orders: ShipOrders): OrderChoice | null {
  if (!ship.portId) return null
  const t = getShipType(ship.typeId)
  let best: OrderChoice | null = null
  for (const o of portOffers(s, ship.portId)) {
    if (offerFits(ship, t, o) || !inArea(orders, o.to)) continue
    if (fuelForVoyage(getRoute(o.from, o.to).nm, t, ship.condition, orders.pace, captainMods(ship)) > t.fuelCapacity) continue
    const e = voyageEstimate(s, ship.id, o.to, o, orders.pace)
    const profit = e.profit - Math.round(o.pay * BROKER_FEE)
    if (e.late > 0 || profit <= 0) continue
    const perDay = profit / e.plan.arriveInDays
    if (!best || perDay > best.perDay) best = { contract: o, profit, perDay }
  }
  return best
}

/** Where to sail empty: the nearest area port, preferring big ones when the ship is already inside. */
function repositionTarget(s: GameState, ship: OwnedShip, orders: ShipOrders): string | null {
  const from = ship.portId!
  const t = getShipType(ship.typeId)
  const m = captainMods(ship)
  const inside = inArea(orders, from)
  const options = PORTS.filter(
    (p) => p.id !== from && portOpen(p, s.day) && inArea(orders, p.id) && fuelForVoyage(getRoute(from, p.id).nm, t, ship.condition, orders.pace, m) <= t.fuelCapacity,
  )
  if (!options.length) return null
  // Inside the area: try a busy port nearby. Outside: just get back in.
  const score = (p: (typeof options)[number]) => getRoute(from, p.id).nm / (inside ? p.size * p.size : 1)
  return options.reduce((a, b) => (score(b) < score(a) ? b : a)).id
}

/** Give every idle ship under orders its next job. Returns a new state. */
export function runOrders(state: GameState): GameState {
  if (state.bankrupt || !state.ships.some((x) => x.orders && x.portId && x.dockUntil === null)) return state
  let s = state
  for (const id of state.ships.map((x) => x.id)) {
    const ship = s.ships.find((x) => x.id === id)
    const orders = ship?.orders
    if (!ship || !orders || !ship.portId || ship.voyage || ship.dockUntil !== null) continue
    try {
      s = nextJob(s, ship, orders)
    } catch {
      // Not enough cash for a repair, say: try again tomorrow.
    }
  }
  return s
}

function nextJob(s: GameState, ship: OwnedShip, orders: ShipOrders): GameState {
  const portId = ship.portId!
  if (orders.autoRepair && ship.condition < AUTO_REPAIR_BELOW && canRepairAt(portId) && repairQuote(ship).cost <= s.money) {
    return startRepair(s, ship.id)
  }
  const best = bestOffer(s, ship, orders)
  if (best) return depart(s, ship.id, best.contract.to, best.contract, orders.pace)

  const waited = orders.waitingSince !== undefined ? s.day - orders.waitingSince : 0
  if (!inArea(orders, portId) || waited >= MARKET_WEEK) {
    const to = repositionTarget(s, ship, orders)
    if (to) return depart(s, ship.id, to, null, orders.pace)
  }
  if (orders.waitingSince === undefined) {
    const out = clone(s)
    getShip(out, ship.id).orders!.waitingSince = s.day
    return out
  }
  return s
}
