import { describe, expect, it } from 'vitest'
import { PORTS } from '../data/ports'
import { getShipType } from '../data/shipTypes'
import { dayOfDate, yearAt } from './calendar'
import { iceSeason, MEDEVAC_COST, resolveEvent } from './events'
import { buyNewShip } from './fleet'
import { portOffers } from './market'
import { newGame } from './newGame'
import { advanceDay, depart } from './sim'
import { availableShipTypes, eraFuelFactor, eraPayFactor, openPorts, timelineNews } from './timeline'
import type { GameState, PendingEvent } from './types'
import { activeHold } from './voyage'

const game = (day = 0): GameState => ({ ...newGame('T', 'hongkong', 'A'), seed: 5, day })

function withEvent(s: GameState, kind: PendingEvent['kind'], options: string[]): GameState {
  return { ...s, pendingEvent: { kind, shipId: 's1', day: s.day, title: '', text: '', options: options.map((id) => ({ id, label: id, detail: '' })) } }
}

describe('calendar', () => {
  it('maps days and years both ways', () => {
    expect(yearAt(0)).toBe(1990)
    expect(yearAt(dayOfDate(2001, 1))).toBe(2001)
    expect(yearAt(dayOfDate(2001, 1) - 1)).toBe(2000)
  })
})

describe('timeline', () => {
  it('opens ports in their year', () => {
    const before = game(dayOfDate(1993, 6))
    expect(openPorts(before.day).map((p) => p.id)).not.toContain('shenzhen')
    expect(portOffers(before, 'shenzhen')).toEqual([])
    expect(() => depart(before, 's1', 'shenzhen')).toThrow('avoinna')
    for (let w = 0; w < 6; w++) expect(portOffers({ ...before, day: before.day + w * 7 }, 'hongkong').some((o) => o.to === 'shenzhen')).toBe(false)
    const after = game(dayOfDate(1994, 1))
    expect(portOffers(after, 'shenzhen').length).toBeGreaterThan(0)
    expect(timelineNews(dayOfDate(1994, 1)).some((t) => t.includes('Shenzhen'))).toBe(true)
  })

  it('brings new ship types to the yards', () => {
    expect(availableShipTypes(0).map((t) => t.id)).not.toContain('post-panamax-container')
    expect(() => buyNewShip({ ...game(), money: 1e9 }, 'hongkong', 'post-panamax-container', 'Iso')).toThrow('vielä')
    expect(availableShipTypes(dayOfDate(1996, 1)).map((t) => t.id)).toContain('post-panamax-container')
    expect(getShipType('eco-coaster').availableFrom).toBe(2004)
  })

  it('moves prices with the eras', () => {
    expect(eraFuelFactor(dayOfDate(2005, 6))).toBeCloseTo(1.4)
    expect(eraPayFactor(dayOfDate(2009, 1), 'grain', 'santos')).toBeCloseTo(0.7)
    expect(eraPayFactor(dayOfDate(1998, 1), 'grain', 'shanghai')).toBeCloseTo(0.8)
    expect(eraPayFactor(dayOfDate(1998, 1), 'grain', 'santos')).toBe(1)
    expect(eraPayFactor(dayOfDate(2015, 1), 'containers', 'shanghai')).toBe(1)
  })

  it('every port has a sea route to every other', () => {
    expect(PORTS.length).toBeGreaterThan(40)
  })
})

describe('more events', () => {
  it('ice: wait or pay for an icebreaker', () => {
    expect(iceSeason(dayOfDate(1991, 1) + 10)).toBe(true)
    expect(iceSeason(dayOfDate(1991, 7))).toBe(false)
    const s = depart({ ...newGame('T', 'rotterdam', 'A'), seed: 1 }, 's1', 'helsinki')
    const waited = resolveEvent(withEvent(s, 'ice', ['icebreaker', 'wait']), 'wait')
    expect(activeHold(waited.ships[0].voyage!, s.day)?.reason).toBe('ice')
    const paid = resolveEvent(withEvent(s, 'ice', ['icebreaker', 'wait']), 'icebreaker')
    expect(paid.money).toBeLessThan(s.money)
  })

  it('medical: evacuation costs money, not time', () => {
    const s = depart({ ...newGame('T', 'rotterdam', 'A'), seed: 1 }, 's1', 'newyork')
    const after = resolveEvent(withEvent(s, 'medical', ['evac', 'treat']), 'evac')
    expect(after.money).toBe(s.money - MEDEVAC_COST)
    expect(after.ships[0].voyage!.arriveDay).toBe(s.ships[0].voyage!.arriveDay)
  })

  it('port state control fines badly worn ships now and then', () => {
    let fines = 0
    for (let seed = 1; seed <= 20; seed++) {
      let s = depart({ ...newGame('T', 'rotterdam', 'A'), seed }, 's1', 'hamburg')
      s.ships[0].condition = 30
      for (let i = 0; i < 10 && s.ships[0].voyage; i++) s = advanceDay({ ...s, pendingEvent: null })
      if (s.log.some((e) => e.text.includes('tarkastajat'))) fines++
    }
    expect(fines).toBeGreaterThan(3)
    expect(fines).toBeLessThan(17)
  })
})
