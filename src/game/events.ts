import { getRoute, pointAlong } from '../data/routes'
import { getShipType } from '../data/shipTypes'
import { effectiveFuelPerDay, fuelPrice, latePenalty, paceInfo, sizeFactor } from './economy'
import { captainMods } from './captains'
import { shipValue } from './fleet'
import { fmtMoney } from './format'
import { hashString, rng } from './rng'
import { addLog as log, clone } from './state'
import type { GameState, OwnedShip } from './types'
import { activeHold, holdShip, shiftArrival as shiftArrivalOf, voyageProgress } from './voyage'

// Events at sea. Each day every ship at sea rolls for an incident. Decision
// events stop the clock and wait for the player; small ones apply at once.

/** Daily chances. */
const P_STORM = 0.012
const P_ENGINE = 0.006
const P_PIRATES = 0.05 // per day inside a risk area
const P_TAILWIND = 0.01
const P_RESCUE = 0.004
const P_RUSH = 0.008
const P_MEDICAL = 0.003
/** Per day on the final stretch into an icy port in winter. */
const P_ICE = 0.35

/** Delays and costs of each choice (also shown to the player before choosing). */
export const STORM_DETOUR_DAYS = 2
export const ENGINE_SELF_DAYS = 3
export const ENGINE_SERVICE_DAYS = 1
export const RANSOM_DAYS = 4
export const P_HIJACK = 0.25
export const P_STORM_DAMAGE = 0.5
export const STORM_CARGO_LOSS = 0.15
export const RESCUE_DAYS = 1
export const RESCUE_REWARD = 60_000
/** Rush bonus as a share of the freight pay. */
export const RUSH_BONUS = 0.12
export const MEDEVAC_COST = 35_000
export const P_ILLNESS_WORSE = 0.3
export const ILLNESS_DAYS = 2
export const ILLNESS_COST = 15_000
export const ICE_WAIT_DAYS = 3

/** Ports where winter ice can close the approach (Dec–Mar). */
export const ICY_PORTS = new Set(['helsinki', 'stpetersburg'])

/** Is it ice season on this game day? */
export function iceSeason(day: number): boolean {
  const m = new Date(Date.UTC(1990, 0, 1) + Math.floor(day) * 86_400_000).getUTCMonth()
  return m === 11 || m <= 2
}

/** Waters with a piracy risk: [lonMin, latMin, lonMax, latMax]. */
export const PIRATE_ZONES: { name: string; box: [number, number, number, number] }[] = [
  { name: 'Adeninlahti', box: [42, 8, 60, 16] },
  { name: 'Malakan salmi', box: [95, 0, 104, 7] },
  { name: 'Guineanlahti', box: [-5, -2, 10, 7] },
]

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

export interface RushOffer {
  bonus: number
  /** Whole days earlier the ship would dock. */
  days: number
  /** Arrival day at full speed. */
  arriveDay: number
  /** Value of the extra fuel burned, dollars. */
  fuelCost: number
}

/** What going full speed for the rest of the voyage would give, or null if it is not worth asking. */
export function rushOffer(s: GameState, ship: OwnedShip): RushOffer | null {
  const v = ship.voyage
  if (!v?.contract || (v.pace ?? 'normal') === 'full' || activeHold(v, s.day)) return null
  const t = getShipType(ship.typeId)
  const left = v.arriveDay - s.day
  const cur = paceInfo(v.pace)
  const full = paceInfo('full')
  const leftFull = (left * cur.speed) / full.speed
  const arriveDay = s.day + leftFull
  const days = Math.ceil(v.arriveDay) - Math.ceil(arriveDay)
  if (days < 1 || left < 4) return null
  const m = captainMods(ship)
  const burnFull = leftFull * effectiveFuelPerDay(t, ship.condition, 'full', m)
  if (burnFull > ship.fuel) return null
  const extra = burnFull - left * effectiveFuelPerDay(t, ship.condition, v.pace, m)
  return {
    bonus: Math.max(5000, Math.round((v.contract.pay * RUSH_BONUS) / 1000) * 1000),
    days,
    arriveDay,
    fuelCost: Math.round((extra * fuelPrice(s, v.to)) / 1000) * 1000,
  }
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
    const engineRisk = P_ENGINE * (1 + (100 - ship.condition) / 40) * captainMods(ship).engine

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
    if (!seen.has('rescue') && r.next() < P_RESCUE) {
      s.pendingEvent = {
        kind: 'rescue',
        shipId: ship.id,
        day: s.day,
        title: 'Hätämerkki',
        text: `${ship.name} vastaanotti hätämerkin: pieni kalastusalus on uppoamassa lähistöllä, ja miehistö on pelastuslautalla.`,
        options: [
          { id: 'help', label: `Pelasta miehistö itse (+${RESCUE_DAYS} päivä)`, detail: `Kalastusaluksen vakuutusyhtiö maksaa pelastuspalkkion (${fmtMoney(RESCUE_REWARD)}).` },
          { id: 'report', label: 'Ilmoita meripelastukselle ja jatka', detail: 'Rannikkovartiosto ehtii paikalle muutamassa tunnissa. Aikataulu pitää.' },
        ],
      }
      continue
    }
    if (!seen.has('ice') && ICY_PORTS.has(v.to) && iceSeason(s.day) && v.arriveDay - s.day < 3 && r.next() < P_ICE) {
      const fee = costFor(ship, 20000)
      s.pendingEvent = {
        kind: 'ice',
        shipId: ship.id,
        day: s.day,
        title: 'Jäätä edessä',
        text: `Satamaan johtava väylä on jäässä. ${ship.name} ei pääse etenemään omin voimin.`,
        options: [
          { id: 'icebreaker', label: `Tilaa jäänmurtaja-avustus (${fmtMoney(fee)})`, detail: 'Jäänmurtaja avaa väylän heti.' },
          { id: 'wait', label: `Odota jäiden heikkenemistä (+${ICE_WAIT_DAYS} päivää)`, detail: 'Ilmaista, mutta laiva seisoo jäissä päiväkausia.' },
        ],
      }
      continue
    }
    if (!seen.has('medical') && r.next() < P_MEDICAL) {
      s.pendingEvent = {
        kind: 'medical',
        shipId: ship.id,
        day: s.day,
        title: 'Sairastunut merimies',
        text: `Laivan ${ship.name} matruusi on sairastunut vakavasti. Laivan lääkintävarustus riittää ehkä, mutta varmaa se ei ole.`,
        options: [
          { id: 'evac', label: `Helikopterievakuointi (${fmtMoney(MEDEVAC_COST)})`, detail: 'Potilas pääsee heti sairaalaan. Matka jatkuu ilman viivettä.' },
          { id: 'treat', label: 'Hoidetaan laivalla', detail: 'Ilmaista, mutta jos tila pahenee, laiva joutuu poikkeamaan reitiltä.' },
        ],
      }
      continue
    }
    const rush = rushOffer(s, ship)
    if (rush && !seen.has('rush') && r.next() < P_RUSH) {
      const c = v.contract!
      s.pendingEvent = {
        kind: 'rush',
        shipId: ship.id,
        day: s.day,
        title: 'Vastaanottajalla on kiire',
        text: `Lastin vastaanottaja tarvitsee lastin aiemmin ja lupaa ${fmtMoney(rush.bonus)} bonuksen, jos ${ship.name} on perillä viimeistään ${rush.days} päivää arvioitua aiemmin. Rahtimaksu ${fmtMoney(c.pay)} maksetaan joka tapauksessa.`,
        options: [
          { id: 'keep', label: 'Pidä nykyinen vauhti', detail: 'Ei bonusta, ei lisäkuluja.' },
          { id: 'rush', label: `Täysi vauhti loppumatkaksi (bonus ${fmtMoney(rush.bonus)})`, detail: 'Polttoainetta kuluu enemmän ja laiva kuluu nopeammin. Myrsky tai konevika voi viedä bonuksen.' },
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
  const s = clone(state)
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
    } else if (r.next() < 1 - P_STORM_DAMAGE * captainMods(ship).storm) {
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
    } else if (r.next() < P_HIJACK * captainMods(ship).hijack) {
      const ransom = Math.round((shipValue(ship) * 0.05) / 1000) * 1000
      holdShip(v, s.day, RANSOM_DAYS, 'pirates')
      spend(ransom, `Merirosvot kaappasivat laivan ${ship.name}! Lunnaat maksettiin, ja matka viivästyy neljä päivää.`)
    } else {
      log(s, { kind: 'event', text: `${ship.name} ylitti riskialueen ilman välikohtauksia.` })
    }
  } else if (ev.kind === 'rescue') {
    if (optionId === 'help') {
      holdShip(v, s.day, RESCUE_DAYS, 'rescue')
      s.stats.rescues += 1
      s.money += RESCUE_REWARD
      s.ledger.awards += RESCUE_REWARD
      log(s, { kind: 'award', text: `${ship.name} pelasti kalastusaluksen miehistön. Vakuutusyhtiö maksoi pelastuspalkkion.`, amount: RESCUE_REWARD })
    } else {
      log(s, { kind: 'event', text: `${ship.name} ilmoitti hätämerkistä meripelastukselle ja jatkoi matkaa.` })
    }
  } else if (ev.kind === 'ice') {
    if (optionId === 'icebreaker') {
      spend(costFor(ship, 20000), `Jäänmurtaja avasi väylän laivalle ${ship.name}.`)
    } else {
      holdShip(v, s.day, ICE_WAIT_DAYS, 'ice')
      log(s, { kind: 'event', text: `${ship.name} odottaa jäissä ${ICE_WAIT_DAYS} päivää.` })
    }
  } else if (ev.kind === 'medical') {
    if (optionId === 'evac') {
      spend(MEDEVAC_COST, `Helikopteri haki sairastuneen matruusin laivalta ${ship.name}.`)
    } else if (r.next() < P_ILLNESS_WORSE) {
      shiftArrival(ship, s.day, ILLNESS_DAYS)
      spend(ILLNESS_COST, `Matruusin tila paheni. ${ship.name} poikkesi lähimpään satamaan, ja matka viivästyy ${ILLNESS_DAYS} päivää.`)
    } else {
      log(s, { kind: 'event', text: `Laivan ${ship.name} matruusi toipui laivalla.` })
    }
  } else if (ev.kind === 'rush') {
    const rush = rushOffer(state, state.ships.find((x) => x.id === ship.id)!)
    if (optionId === 'rush' && rush) {
      shiftArrival(ship, s.day, rush.arriveDay - v.arriveDay)
      v.pace = 'full'
      v.rush = { bonus: rush.bonus, byDay: Math.ceil(rush.arriveDay) }
      log(s, { kind: 'event', text: `${ship.name} ajaa loppumatkan täyttä vauhtia ehtiäkseen kiirebonukseen.` })
    } else {
      log(s, { kind: 'event', text: `${ship.name} jatkaa entistä vauhtia.` })
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
  /** Money earned (rescue reward, rush bonus). */
  reward: number
  /** Value of extra fuel burned. */
  fuel: number
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
  const outcome = (delay: number, cost = 0, cargoShare = 0, reward = 0, fuel = 0): Outcome => {
    const arriveDay = Math.ceil(v.arriveDay + delay)
    const lateDays = c ? Math.max(0, arriveDay - c.deadlineDay) : null
    return {
      delay,
      arriveDay,
      lateDays,
      penalty: c && lateDays ? latePenalty(c, lateDays) : 0,
      cost,
      cargoLoss: c ? Math.round(c.pay * (v.payFactor ?? 1) * cargoShare) : 0,
      reward,
      fuel,
    }
  }
  const ransom = Math.round((shipValue(ship) * 0.05) / 1000) * 1000
  const rush = ev.kind === 'rush' ? rushOffer(s, ship) : null
  const options = ev.options.map((o): OptionOutlook => {
    switch (`${ev.kind}:${o.id}`) {
      case 'storm:around':
        return { optionId: o.id, sure: outcome(STORM_DETOUR_DAYS) }
      case 'storm:through':
        return { optionId: o.id, sure: outcome(0), risk: { chance: P_STORM_DAMAGE * captainMods(ship).storm, outcome: outcome(0, 0, STORM_CARGO_LOSS) } }
      case 'engine:self':
        return { optionId: o.id, sure: outcome(ENGINE_SELF_DAYS) }
      case 'engine:service':
        return { optionId: o.id, sure: outcome(ENGINE_SERVICE_DAYS, costFor(ship, 30000)) }
      case 'pirates:guards':
        return { optionId: o.id, sure: outcome(0, costFor(ship, 40000)) }
      case 'pirates:risk':
        return { optionId: o.id, sure: outcome(0), risk: { chance: P_HIJACK * captainMods(ship).hijack, outcome: outcome(RANSOM_DAYS, ransom) } }
      case 'ice:icebreaker':
        return { optionId: o.id, sure: outcome(0, costFor(ship, 20000)) }
      case 'ice:wait':
        return { optionId: o.id, sure: outcome(ICE_WAIT_DAYS) }
      case 'medical:evac':
        return { optionId: o.id, sure: outcome(0, MEDEVAC_COST) }
      case 'medical:treat':
        return { optionId: o.id, sure: outcome(0), risk: { chance: P_ILLNESS_WORSE, outcome: outcome(ILLNESS_DAYS, ILLNESS_COST) } }
      case 'rescue:help':
        return { optionId: o.id, sure: outcome(RESCUE_DAYS, 0, 0, RESCUE_REWARD) }
      case 'rush:rush':
        return rush ? { optionId: o.id, sure: outcome(rush.arriveDay - v.arriveDay, 0, 0, rush.bonus, rush.fuelCost) } : { optionId: o.id, sure: outcome(0) }
      default:
        return { optionId: o.id, sure: outcome(0) }
    }
  })
  return { ship, options }
}
