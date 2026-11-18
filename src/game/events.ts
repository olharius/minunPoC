import { getRoute, pointAlong } from '../data/routes'
import { getShipType } from '../data/shipTypes'
import { latePenalty, sizeFactor } from './economy'
import { shipValue } from './fleet'
import { fmtMoney } from './format'
import { hashString, rng } from './rng'
import type { GameState, LogEntry, OwnedShip } from './types'
import { activeHold, holdShip, shiftArrival as shiftArrivalOf, voyageProgress } from './voyage'

// Events at sea. Each day every ship at sea rolls for an incident. Decision
// events stop the clock and wait for the player; small ones apply at once.

/** Daily chances. */
const P_STORM = 0.012
const P_ENGINE = 0.006
const P_PIRATES = 0.05 // per day inside a risk area
const P_TAILWIND = 0.01

/** Delays and costs of each choice (also shown to the player before choosing). */
export const STORM_DETOUR_DAYS = 2
export const ENGINE_SELF_DAYS = 3
export const ENGINE_SERVICE_DAYS = 1
export const RANSOM_DAYS = 4
export const P_HIJACK = 0.25
export const P_STORM_DAMAGE = 0.5
export const STORM_CARGO_LOSS = 0.15

/** Waters with a piracy risk: [lonMin, latMin, lonMax, latMax]. */
export const PIRATE_ZONES: { name: string; box: [number, number, number, number] }[] = [
  { name: 'Adeninlahti', box: [42, 8, 60, 16] },
  { name: 'Malakan salmi', box: [95, 0, 104, 7] },
  { name: 'Guineanlahti', box: [-5, -2, 10, 7] },
]

function log(s: GameState, e: Omit<LogEntry, 'day'>) {
  s.log = [{ day: s.day, ...e }, ...s.log].slice(0, 80)
}

/** Where the ship is now, [lon, lat]. */
export function shipPosition(ship: OwnedShip, day: number): [number, number] {
  const v = ship.voyage!
  return pointAlong(getRoute(v.from, v.to), voyageProgress(v, day))
}

export function pirateZoneAt([lon, lat]: [number, number]): string | null {
  const z = PIRATE_ZONES.find(({ box: [x1, y1, x2, y2] }) => lon >= x1 && lon <= x2 && lat >= y1 && lat <= y2)
  return z?.name ?? null
}

/** Change a voyage's arrival by `days`, keeping the ship moving (see voyage.ts). */
export function shiftArrival(ship: OwnedShip, day: number, days: number) {
  shiftArrivalOf(ship.voyage!, day, days)
}

function costFor(ship: OwnedShip, base: number) {
  return Math.round((base * sizeFactor(getShipType(ship.typeId))) / 1000) * 1000
}

/** Roll today's events. Mutates `s`; may set s.pendingEvent. */
export function rollSeaEvents(s: GameState) {
  for (const ship of s.ships) {
    const v = ship.voyage
    if (!v || s.pendingEvent) continue
    // Nothing on the final stretch into port.
    if (v.arriveDay - s.day < 1) continue
    // A ship standing still (repairs, pirates) has nothing new happen to it.
    if (activeHold(v, s.day)) continue
    const r = rng(hashString(`${s.seed}:sea:${ship.id}:${s.day}`))
    const seen = new Set(v.events ?? [])
    const zone = pirateZoneAt(shipPosition(ship, s.day))
    const engineRisk = P_ENGINE * (1 + (100 - ship.condition) / 40)

    if (zone && !seen.has('pirates') && r.next() < P_PIRATES) {
      const guards = costFor(ship, 40000)
      s.pendingEvent = {
        kind: 'pirates',
        shipId: ship.id,
        day: s.day,
        title: `Merirosvovaroitus: ${zone}`,
        text: `${ship.name} on saapumassa alueelle, jolla on viime viikkoina nähty merirosvoja. Miten toimitaan?`,
        options: [
          { id: 'guards', label: `Palkkaa aseistetut vartijat (${fmtMoney(guards)})`, detail: 'Turvallinen, mutta maksaa.' },
          { id: 'risk', label: 'Jatka matkaa täyttä vauhtia', detail: 'Ilmaista, mutta noin joka neljäs laiva joutuu maksamaan lunnaita ja menettää päiviä.' },
        ],
      }
      continue
    }
    if (!seen.has('storm') && r.next() < P_STORM) {
      s.pendingEvent = {
        kind: 'storm',
        shipId: ship.id,
        day: s.day,
        title: 'Myrsky edessä',
        text: `${ship.name} on matkalla kohti voimistuvaa myrskyä. Kapteeni kysyy ohjeita.`,
        options: [
          { id: 'around', label: 'Kierrä myrsky (+2 päivää)', detail: 'Laiva ja lasti säästyvät, mutta matka pitenee.' },
          { id: 'through', label: 'Aja myrskyn läpi', detail: 'Puolet kerroista selvitään säikähdyksellä, muuten laiva vaurioituu ja osa lastista turmeltuu.' },
        ],
      }
      continue
    }
    if (!seen.has('engine') && r.next() < engineRisk) {
      const tug = costFor(ship, 30000)
      s.pendingEvent = {
        kind: 'engine',
        shipId: ship.id,
        day: s.day,
        title: 'Konevika',
        text: `${ship.name}: pääkone sammui keskellä merta. Konemestarin mukaan vika on korjattavissa.`,
        options: [
          { id: 'self', label: 'Korjataan omin voimin (+3 päivää)', detail: 'Ei kuluja, mutta laiva ajelehtii päiväkausia.' },
          { id: 'service', label: `Tilaa huoltoalus (${fmtMoney(tug)}, +1 päivä)`, detail: 'Nopea apu varaosineen.' },
        ],
      }
      continue
    }
    if (r.next() < P_TAILWIND && v.arriveDay - s.day > 2) {
      shiftArrival(ship, s.day, -1)
      log(s, { kind: 'event', text: `${ship.name} sai myötätuulta ja on perillä päivää aiemmin.` })
    }
  }
}

/** Apply the player's choice to the pending event. */
export function resolveEvent(state: GameState, optionId: string): GameState {
  const ev = state.pendingEvent
  if (!ev) return state
  const s = structuredClone(state)
  s.pendingEvent = null
  const ship = s.ships.find((x) => x.id === ev.shipId)
  if (!ship?.voyage) return s
  const v = ship.voyage
  v.events = [...(v.events ?? []), ev.kind]
  const r = rng(hashString(`${s.seed}:resolve:${ship.id}:${s.day}:${ev.kind}`))
  const spend = (amount: number, text: string) => {
    s.money -= amount
    s.ledger.incidents += amount
    log(s, { kind: 'event', text, amount: -amount })
  }

  if (ev.kind === 'storm') {
    if (optionId === 'around') {
      shiftArrival(ship, s.day, STORM_DETOUR_DAYS)
      log(s, { kind: 'event', text: `${ship.name} kiersi myrskyn. Matka pitenee kahdella päivällä.` })
    } else if (r.next() < 1 - P_STORM_DAMAGE) {
      log(s, { kind: 'event', text: `${ship.name} selvisi myrskystä ehjänä.` })
    } else {
      ship.condition = Math.max(0, ship.condition - 8)
      if (v.contract) v.payFactor = (v.payFactor ?? 1) * (1 - STORM_CARGO_LOSS)
      log(s, {
        kind: 'event',
        text: `${ship.name} kärsi myrskyssä vaurioita (kunto −8 %)${v.contract ? ', ja 15 % lastista turmeltui' : ''}.`,
      })
    }
  } else if (ev.kind === 'engine') {
    if (optionId === 'service') {
      holdShip(v, s.day, ENGINE_SERVICE_DAYS, 'service')
      spend(costFor(ship, 30000), `${ship.name}: huoltoalus korjaa koneen. Laiva seisoo paikallaan päivän.`)
    } else {
      holdShip(v, s.day, ENGINE_SELF_DAYS, 'repair')
      ship.condition = Math.max(0, ship.condition - 2)
      log(s, { kind: 'event', text: `${ship.name}: miehistö korjaa konetta omin voimin. Laiva seisoo paikallaan kolme päivää (kunto −2 %).` })
    }
  } else if (ev.kind === 'pirates') {
    if (optionId === 'guards') {
      spend(costFor(ship, 40000), `${ship.name} palkkasi vartijat ja ylitti riskialueen turvallisesti.`)
    } else if (r.next() < P_HIJACK) {
      const ransom = Math.round((shipValue(ship) * 0.05) / 1000) * 1000
      holdShip(v, s.day, RANSOM_DAYS, 'pirates')
      spend(ransom, `Merirosvot kaappasivat laivan ${ship.name}! Lunnaat maksettiin, ja matka viivästyy neljä päivää.`)
    } else {
      log(s, { kind: 'event', text: `${ship.name} ylitti riskialueen ilman välikohtauksia.` })
    }
  }
  return s
}

/** What one outcome of a choice means for the schedule and the money. */
export interface Outcome {
  /** Extra days at sea. */
  delay: number
  /** Day the ship docks. */
  arriveDay: number
  /** Days past the deadline (0 = on time); null without a contract. */
  lateDays: number | null
  /** Contract penalty, dollars. */
  penalty: number
  /** Money paid out at sea (service ship, guards, ransom). */
  cost: number
  /** Freight pay lost to damaged cargo. */
  cargoLoss: number
}

export interface OptionOutlook {
  optionId: string
  /** What surely happens, or the good case of a gamble. */
  sure: Outcome
  /** The bad case of a gamble and its chance. */
  risk?: { chance: number; outcome: Outcome }
}

/** The ship's job and how each choice of the pending event changes it. */
export function eventOutlook(s: GameState): { ship: OwnedShip; options: OptionOutlook[] } | null {
  const ev = s.pendingEvent
  const ship = ev && s.ships.find((x) => x.id === ev.shipId)
  if (!ev || !ship?.voyage) return null
  const v = ship.voyage
  const c = v.contract
  const outcome = (delay: number, cost = 0, cargoShare = 0): Outcome => {
    const arriveDay = Math.ceil(v.arriveDay + delay)
    const lateDays = c ? Math.max(0, arriveDay - c.deadlineDay) : null
    return {
      delay,
      arriveDay,
      lateDays,
      penalty: c && lateDays ? latePenalty(c, lateDays) : 0,
      cost,
      cargoLoss: c ? Math.round(c.pay * (v.payFactor ?? 1) * cargoShare) : 0,
    }
  }
  const ransom = Math.round((shipValue(ship) * 0.05) / 1000) * 1000
  const options = ev.options.map((o): OptionOutlook => {
    switch (`${ev.kind}:${o.id}`) {
      case 'storm:around':
        return { optionId: o.id, sure: outcome(STORM_DETOUR_DAYS) }
      case 'storm:through':
        return { optionId: o.id, sure: outcome(0), risk: { chance: P_STORM_DAMAGE, outcome: outcome(0, 0, STORM_CARGO_LOSS) } }
      case 'engine:self':
        return { optionId: o.id, sure: outcome(ENGINE_SELF_DAYS) }
      case 'engine:service':
        return { optionId: o.id, sure: outcome(ENGINE_SERVICE_DAYS, costFor(ship, 30000)) }
      case 'pirates:guards':
        return { optionId: o.id, sure: outcome(0, costFor(ship, 40000)) }
      case 'pirates:risk':
        return { optionId: o.id, sure: outcome(0), risk: { chance: P_HIJACK, outcome: outcome(RANSOM_DAYS, ransom) } }
      default:
        return { optionId: o.id, sure: outcome(0) }
    }
  })
  return { ship, options }
}
