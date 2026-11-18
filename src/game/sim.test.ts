import { describe, expect, it } from 'vitest'
import { PORTS } from '../data/ports'
import { getRoute, pointAlong } from '../data/routes'
import { getShipType } from '../data/shipTypes'
import { latePay, planVoyage } from './economy'
import { offerFits, portOffers } from './market'
import { newGame } from './newGame'
import { parseSave, toSaveFile } from './save'
import { acceptOffer, advanceDay, depart } from './sim'
import type { GameState } from './types'

const game = () => ({ ...newGame('Testi', 'rotterdam', 'Aallotar'), seed: 42 })

function runUntilDocked(s: GameState, shipId = 's1', max = 200): GameState {
  for (let i = 0; i < max; i++) {
    s = advanceDay(s)
    if (s.ships.find((x) => x.id === shipId)!.portId) return s
  }
  throw new Error('never arrived')
}

describe('routes', () => {
  it('connects every pair of ports', () => {
    for (const a of PORTS) for (const b of PORTS) if (a.id !== b.id) expect(getRoute(a.id, b.id).nm).toBeGreaterThan(0)
  })

  it('uses Suez between Europe and Asia and Panama between the US coasts', () => {
    const asia = getRoute('rotterdam', 'singapore')
    expect(asia.canals).toContain('suez')
    expect(asia.nm).toBeGreaterThan(7800)
    expect(asia.nm).toBeLessThan(9000)
    expect(getRoute('newyork', 'losangeles').canals).toContain('panama')
  })

  it('reverses paths for the opposite direction', () => {
    const there = getRoute('helsinki', 'london')
    const back = getRoute('london', 'helsinki')
    expect(back.nm).toBe(there.nm)
    expect(back.path[0]).toEqual(there.path[there.path.length - 1])
    expect(pointAlong(there, 0)).toEqual(there.path[0])
    expect(pointAlong(there, 1)[0]).toBeCloseTo(there.path[there.path.length - 1][0])
  })
})

describe('market', () => {
  it('is deterministic and refreshes weekly', () => {
    const s = game()
    expect(portOffers(s, 'rotterdam')).toEqual(portOffers(s, 'rotterdam'))
    expect(portOffers({ ...s, day: 7 }, 'rotterdam')).not.toEqual(portOffers(s, 'rotterdam'))
  })

  it('always has work for the starting ship in big ports', () => {
    for (let seed = 0; seed < 20; seed++) {
      const s = { ...game(), seed }
      const ship = s.ships[0]
      const t = getShipType(ship.typeId)
      expect(portOffers(s, 'rotterdam').some((o) => !offerFits(ship, t, o))).toBe(true)
    }
  })
})

describe('voyages', () => {
  it('delivers cargo, pays and charges fees', () => {
    let s = game()
    const ship = s.ships[0]
    const t = getShipType(ship.typeId)
    const offer = portOffers(s, 'rotterdam').find((o) => !offerFits(ship, t, o))!
    const plan = planVoyage(s, 's1', offer.to)
    s = acceptOffer(s, 's1', offer.id)
    expect(s.ships[0].voyage?.contract?.id).toBe(offer.id)
    expect(portOffers(s, 'rotterdam').find((o) => o.id === offer.id)).toBeUndefined()

    const moneyAfterDeparture = s.money
    s = runUntilDocked(s)
    expect(s.ships[0].portId).toBe(offer.to)
    expect(s.day).toBe(plan.arriveInDays)
    const expected = moneyAfterDeparture + offer.pay - plan.harbourFee - plan.arriveInDays * t.dailyCost
    expect(s.money).toBe(expected)
    expect(s.ledger.revenue).toBe(offer.pay)
    expect(s.ships[0].fuel).toBeGreaterThanOrEqual(0)
    expect(s.log[0].kind).toBe('delivery')
  })

  it('buys missing fuel before leaving', () => {
    let s = game()
    s.ships[0].fuel = 0
    s = depart(s, 's1', 'hamburg')
    expect(s.ships[0].fuel).toBeGreaterThan(0)
    expect(s.ledger.fuel).toBeGreaterThan(0)
  })

  it('refuses voyages longer than one tank', () => {
    const s = newGame('A', 'sydney', 'B')
    // coaster: 600 t tank, 14 t/day → about 40 days of range
    expect(() => depart(s, 's1', 'helsinki')).toThrow('liian pitkä')
  })

  it('cuts pay for late delivery', () => {
    expect(latePay(100_000, 0)).toBe(100_000)
    expect(latePay(100_000, 3)).toBe(70_000)
    expect(latePay(100_000, 30)).toBe(30_000)
  })
})

describe('save migration', () => {
  it('upgrades a version 1 save', () => {
    const v1 = {
      game: 'minunpoc',
      version: 1,
      savedAt: '',
      state: { companyName: 'Vanha', homePortId: 'helsinki', day: 3, startDate: '1990-01-01', money: 5, nextId: 2, ships: [{ id: 's1', name: 'X', typeId: 'coaster', portId: 'helsinki', fuel: 1, condition: 100 }] },
    }
    const s = parseSave(JSON.stringify(v1)).state
    expect(s.ships[0].voyage).toBeNull()
    expect(s.log).toEqual([])
    expect(typeof s.seed).toBe('number')
    expect(parseSave(JSON.stringify(toSaveFile(s))).state).toEqual(s)
  })
})
