import { describe, expect, it } from 'vitest'
import { getRoute } from '../data/routes'
import { eventOutlook, pirateZoneAt, resolveEvent, shiftArrival, shipPosition } from './events'
import { portOffers } from './market'
import { newGame } from './newGame'
import { cargoFactor, monthNews, portOnStrike } from './news'
import { parseSave } from './save'
import { activeHold, voyageProgress } from './voyage'
import { advanceDay, applyDocking, depart } from './sim'
import type { GameState } from './types'

const sailing = (seed = 3): GameState => depart({ ...newGame('T', 'rotterdam', 'A'), seed }, 's1', 'singapore')

const OPTS = { engine: ['self', 'service'], pirates: ['guards', 'risk'], storm: ['around', 'through'] }
function withEvent(s: GameState, kind: 'engine' | 'pirates' | 'storm'): GameState {
  return {
    ...s,
    pendingEvent: { kind, shipId: s.ships[0].id, day: s.day, title: '', text: '', options: OPTS[kind].map((id) => ({ id, label: id, detail: '' })) },
  }
}
/** A day without new events, so a test sees only the effect it set up. */
function calmDay(s: GameState): GameState {
  const v = s.ships[0].voyage!
  return advanceDay({ ...s, ships: [{ ...s.ships[0], voyage: { ...v, events: ['storm', 'engine', 'pirates', 'rescue', 'rush'] } }, ...s.ships.slice(1)] })
}

function untilEvent(s: GameState, max = 60): GameState {
  for (let i = 0; i < max && !s.pendingEvent; i++) s = advanceDay(s)
  return s
}

describe('events at sea', () => {
  it('eventually asks the player something on a long voyage', () => {
    let found = 0
    for (let seed = 0; seed < 20; seed++) if (untilEvent(sailing(seed)).pendingEvent) found++
    expect(found).toBeGreaterThan(5)
  })

  it('a storm detour delays arrival but keeps the ship in place', () => {
    for (let seed = 0; seed < 200; seed++) {
      let s = untilEvent(sailing(seed))
      if (s.pendingEvent?.kind !== 'storm') continue
      const ship = s.ships[0]
      const before = ship.voyage!.arriveDay
      const pos = shipPosition(ship, s.day)
      s = resolveEvent(s, 'around')
      expect(s.pendingEvent).toBeNull()
      expect(s.ships[0].voyage!.arriveDay).toBeCloseTo(before + 2)
      const after = shipPosition(s.ships[0], s.day)
      expect(after[0]).toBeCloseTo(pos[0], 3)
      expect(after[1]).toBeCloseTo(pos[1], 3)
      expect(s.ships[0].voyage!.events).toContain('storm')
      return
    }
    throw new Error('no storm found')
  })

  it('engine repairs stop the ship for the given days, then it sails on', () => {
    for (const [option, days] of [
      ['self', 3],
      ['service', 1],
    ] as const) {
      let s = sailing()
      for (let i = 0; i < 5; i++) s = advanceDay({ ...s, pendingEvent: null })
      s = withEvent(s, 'engine')
      const departDay = s.ships[0].voyage!.departDay
      const arrive = s.ships[0].voyage!.arriveDay
      const pos = shipPosition(s.ships[0], s.day)
      s = resolveEvent(s, option)
      expect(s.ships[0].voyage!.arriveDay).toBeCloseTo(arrive + days)
      expect(s.ships[0].voyage!.departDay).toBe(departDay)
      for (let i = 0; i < days; i++) {
        const fuel = s.ships[0].fuel
        s = calmDay(s)
        const p = shipPosition(s.ships[0], s.day)
        // Standing still: no movement, no fuel burnt.
        expect(p[0]).toBeCloseTo(pos[0], 3)
        expect(p[1]).toBeCloseTo(pos[1], 3)
        expect(s.ships[0].fuel).toBe(fuel)
      }
      s = calmDay(s)
      const moved = shipPosition(s.ships[0], s.day)
      expect(Math.abs(moved[0] - pos[0]) + Math.abs(moved[1] - pos[1])).toBeGreaterThan(0.1)
    }
  })

  it('a ransom stops the ship for four days', () => {
    let s = sailing()
    for (let i = 0; i < 5; i++) s = advanceDay({ ...s, pendingEvent: null })
    // Find a seed where the pirates strike.
    for (let seed = 0; seed < 200; seed++) {
      const t = resolveEvent(withEvent({ ...s, seed }, 'pirates'), 'risk')
      const v = t.ships[0].voyage!
      if (!v.holds?.length) continue
      expect(v.holds[0]).toMatchObject({ from: t.day, until: t.day + 4, reason: 'pirates' })
      expect(activeHold(v, t.day + 3.5)).not.toBeNull()
      expect(activeHold(v, t.day + 4)).toBeNull()
      expect(t.money).toBeLessThan(s.money)
      return
    }
    throw new Error('pirates never struck')
  })

  it('progress keeps working for voyages from older saves', () => {
    const s = sailing()
    const v = s.ships[0].voyage!
    expect(v.anchor).toBeUndefined()
    expect(voyageProgress(v, v.departDay)).toBe(0)
    expect(voyageProgress(v, (v.departDay + v.arriveDay) / 2)).toBeCloseTo(0.5)
    expect(voyageProgress(v, v.arriveDay)).toBe(1)
  })

  it('tells how each choice changes the schedule and the penalty', () => {
    let s = sailing()
    const v = s.ships[0].voyage!
    const arrive = Math.ceil(v.arriveDay)
    // A tight Express job: due exactly on the current arrival day.
    v.contract = { id: 'c', cargoId: 'grain', tonnes: 1000, from: v.from, to: v.to, pay: 100000, deadlineDay: arrive, express: true }
    s = withEvent(s, 'engine')
    const look = eventOutlook(s)!
    const self = look.options.find((o) => o.optionId === 'self')!.sure
    const service = look.options.find((o) => o.optionId === 'service')!.sure
    expect(self).toMatchObject({ delay: 3, arriveDay: arrive + 3, lateDays: 3, penalty: 30000 })
    expect(service).toMatchObject({ delay: 1, arriveDay: arrive + 1, lateDays: 1, penalty: 10000 })
    expect(service.cost).toBeGreaterThan(0)
    // The forecast matches what really happens.
    const after = resolveEvent(s, 'self')
    expect(Math.ceil(after.ships[0].voyage!.arriveDay)).toBe(self.arriveDay)

    const pir = eventOutlook(withEvent(s, 'pirates'))!.options.find((o) => o.optionId === 'risk')!
    expect(pir.sure.lateDays).toBe(0)
    expect(pir.risk).toMatchObject({ chance: 0.25, outcome: { delay: 4, lateDays: 4, penalty: 40000 } })
  })

  it('knows the pirate zones', () => {
    expect(pirateZoneAt([50, 12])).toBe('Adeninlahti')
    expect(pirateZoneAt([0, 50])).toBeNull()
    // The Suez route to Singapore passes the Gulf of Aden.
    const path = getRoute('rotterdam', 'singapore').path
    expect(path.some((p) => pirateZoneAt(p) === 'Adeninlahti')).toBe(true)
  })

  it('shiftArrival never lands in the past', () => {
    const s = sailing()
    shiftArrival(s.ships[0], s.day, -999)
    expect(s.ships[0].voyage!.arriveDay).toBeGreaterThan(s.day)
  })
})

describe('auto events', () => {
  it('captains resolve events themselves when allowed', () => {
    let s = sailing(1)
    s = { ...s, settings: { ...s.settings, autoEvents: true } }
    for (let i = 0; i < 60; i++) {
      s = advanceDay(s)
      expect(s.pendingEvent).toBeNull()
    }
  })
})

describe('news', () => {
  it('is quiet in the first month and deterministic later', () => {
    expect(monthNews({ seed: 1 }, 0)).toEqual([])
    expect(monthNews({ seed: 1 }, 5)).toEqual(monthNews({ seed: 1 }, 5))
    expect(monthNews({ seed: 1 }, 5).length).toBeGreaterThan(0)
  })

  it('moves freight rates and closes struck ports', () => {
    for (let month = 1; month < 200; month++) {
      const news = monthNews({ seed: 9 }, month)
      const strike = news.find((n) => n.kind === 'strike')
      if (!strike || strike.kind !== 'strike') continue
      const s = { ...newGame('T', 'rotterdam', 'A'), seed: 9, day: month * 30 }
      expect(portOnStrike(s, strike.portId)).toBe(true)
      expect(portOffers(s, strike.portId)).toEqual([])
      const boom = news.find((n) => n.kind === 'boom')
      if (boom && boom.kind === 'boom') expect(cargoFactor(s, boom.cargoId)).toBeCloseTo(1.35)
      return
    }
    throw new Error('no strike found')
  })
})

describe('docking minigame', () => {
  it('a clean docking refunds part of the harbour fee; hits dent the hull', () => {
    const s = newGame('T', 'rotterdam', 'A')
    const clean = applyDocking(s, 's1', { success: true, hits: 0 })
    expect(clean.money).toBeGreaterThan(s.money)
    const rough = applyDocking(s, 's1', { success: true, hits: 2 })
    expect(rough.ships[0].condition).toBe(96)
    expect(rough.money).toBe(s.money)
  })
})

describe('save v3 → v4', () => {
  it('adds events and settings', () => {
    const g = newGame('A', 'helsinki', 'B') as unknown as Record<string, unknown>
    const { pendingEvent: _p, settings: _s, ...v3state } = g
    void _p
    void _s
    const v3 = { game: 'minunpoc', version: 3, savedAt: '', state: { ...v3state, ledger: { revenue: 0, fuel: 0, harbour: 0, canal: 0, running: 0, repairs: 0, interest: 0 } } }
    const s = parseSave(JSON.stringify(v3)).state
    expect(s.pendingEvent).toBeNull()
    expect(s.settings.manualDocking).toBe(false)
    expect(s.ledger.incidents).toBe(0)
  })
})
