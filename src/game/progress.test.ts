import { describe, expect, it } from 'vitest'
import { PORTS } from '../data/ports'
import { averageFuelPrice, fuelPrice, planVoyage } from './economy'
import { eventOutlook, resolveEvent, rushOffer, RESCUE_REWARD } from './events'
import { MILESTONES, checkMilestones } from './milestones'
import { newGame } from './newGame'
import { parseSave, toSaveFile } from './save'
import { advanceDay, depart } from './sim'
import type { GameState, PendingEvent } from './types'
import { activeHold } from './voyage'

const game = () => ({ ...newGame('T', 'rotterdam', 'A'), seed: 3 })

function withEvent(s: GameState, kind: PendingEvent['kind'], options: string[]): GameState {
  return { ...s, pendingEvent: { kind, shipId: 's1', day: s.day, title: '', text: '', options: options.map((id) => ({ id, label: id, detail: '' })) } }
}

describe('voyage pace', () => {
  it('trades speed for fuel', () => {
    const s = game()
    const eco = planVoyage(s, 's1', 'newyork', 'eco')
    const normal = planVoyage(s, 's1', 'newyork')
    const full = planVoyage(s, 's1', 'newyork', 'full')
    expect(eco.days).toBeGreaterThan(normal.days)
    expect(full.days).toBeLessThan(normal.days)
    expect(eco.fuelNeeded).toBeLessThan(normal.fuelNeeded)
    expect(full.fuelNeeded).toBeGreaterThan(normal.fuelNeeded)
  })

  it('keeps the chosen pace on the voyage and burns fuel by it', () => {
    let eco = depart(game(), 's1', 'hamburg', null, 'eco')
    let normal = depart(game(), 's1', 'hamburg')
    expect(eco.ships[0].voyage?.pace).toBe('eco')
    eco = advanceDay(eco)
    normal = advanceDay(normal)
    expect(eco.ships[0].fuel).toBeGreaterThan(normal.ships[0].fuel)
  })
})

describe('fuel prices', () => {
  it('differ clearly between ports', () => {
    const s = { ...game(), day: 45 }
    const prices = PORTS.map((p) => fuelPrice(s, p.id))
    expect(Math.max(...prices) / Math.min(...prices)).toBeGreaterThan(1.4)
    expect(averageFuelPrice(s)).toBeGreaterThan(0)
  })
})

describe('milestones', () => {
  it('pays each prize once', () => {
    const s = game()
    s.stats.deliveries = 1
    const before = s.money
    const first = checkMilestones(s)
    expect(first.map((m) => m.id)).toContain('first-delivery')
    expect(s.money).toBe(before + first.reduce((a, m) => a + m.reward, 0))
    expect(checkMilestones(s)).toEqual([])
  })

  it('have unique ids and positive targets', () => {
    expect(new Set(MILESTONES.map((m) => m.id)).size).toBe(MILESTONES.length)
    const s = game()
    for (const m of MILESTONES) expect(m.progress(s)[1]).toBeGreaterThan(0)
  })

  it('counts deliveries, on-time streaks and visited ports', () => {
    let s = depart(game(), 's1', 'hamburg')
    for (let i = 0; i < 10 && s.ships[0].voyage; i++) s = advanceDay(s)
    expect(s.stats.portsVisited).toEqual(['rotterdam', 'hamburg'])
  })
})

describe('year review', () => {
  it('closes the year on New Year’s Day', () => {
    let s = { ...game(), day: 364 }
    s = advanceDay(s)
    expect(s.yearReports).toHaveLength(1)
    expect(s.yearReports[0].year).toBe(1990)
    expect(s.yearStart.year).toBe(1991)
    s = advanceDay(s)
    expect(s.yearReports).toHaveLength(1)
  })
})

describe('new events', () => {
  it('rescue: a day lost, a reward won', () => {
    const s = depart(game(), 's1', 'newyork')
    const after = resolveEvent(withEvent(s, 'rescue', ['help', 'report']), 'help')
    expect(after.money).toBe(s.money + RESCUE_REWARD)
    expect(after.stats.rescues).toBe(1)
    expect(activeHold(after.ships[0].voyage!, s.day)?.reason).toBe('rescue')
    expect(after.ships[0].voyage!.arriveDay).toBeCloseTo(s.ships[0].voyage!.arriveDay + 1)
  })

  it('rush: full speed earns a bonus when on time', () => {
    const contract = { id: 'c', cargoId: 'general-goods', tonnes: 1000, from: 'rotterdam', to: 'newyork', pay: 200_000, deadlineDay: 60 }
    let s = depart(game(), 's1', 'newyork', contract)
    const offer = rushOffer(s, s.ships[0])!
    expect(offer.days).toBeGreaterThanOrEqual(1)
    s = withEvent(s, 'rush', ['keep', 'rush'])
    const look = eventOutlook(s)!.options.find((o) => o.optionId === 'rush')!
    expect(look.sure.reward).toBe(offer.bonus)
    s = resolveEvent(s, 'rush')
    expect(s.ships[0].voyage?.pace).toBe('full')
    const money = s.money
    for (let i = 0; i < 40 && s.ships[0].voyage; i++) s = advanceDay({ ...s, ships: s.ships.map((x) => (x.voyage ? { ...x, voyage: { ...x.voyage, events: ['storm', 'engine', 'pirates', 'rescue', 'rush', 'ice', 'medical'] } } : x)) })
    expect(s.ships[0].portId).toBe('newyork')
    expect(s.log.some((e) => e.kind === 'award' && e.amount === offer.bonus)).toBe(true)
    expect(s.money).toBeGreaterThan(money)
  })
})

describe('save v6', () => {
  it('upgrades a version 5 save with stats and a year snapshot', () => {
    const g = newGame('Vanha', 'helsinki', 'B')
    const { stats: _a, milestones: _b, yearStart: _c, yearReports: _d, ...rest } = g
    void [_a, _b, _c, _d]
    const { awards: _e, ...ledger } = g.ledger
    void _e
    const v5 = { game: 'minunpoc', version: 5, savedAt: '', state: { ...rest, ledger, day: 400 } }
    const s = parseSave(JSON.stringify(v5)).state
    expect(s.stats.portsVisited).toEqual(['helsinki'])
    expect(s.ledger.awards).toBe(0)
    expect(s.yearStart.year).toBe(1991)
    expect(parseSave(JSON.stringify(toSaveFile(s))).state).toEqual(s)
  })
})
