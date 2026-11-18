import { describe, expect, it } from 'vitest'
import { getShipType } from '../data/shipTypes'
import { borrow, creditAvailable, creditLimit, monthlyInterest, repay } from './bank'
import { planVoyage } from './economy'
import { buyNewShip, buyUsedShip, fleetValue, repairQuote, sellShip, shipValue, startRepair, usedListings } from './fleet'
import { newGame } from './newGame'
import { parseSave } from './save'
import { advanceDay, depart } from './sim'
import type { GameState } from './types'

const game = (): GameState => ({ ...newGame('Testi', 'rotterdam', 'Aallotar'), seed: 7 })
const days = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) s = advanceDay(s)
  return s
}

describe('shipyard', () => {
  it('buys a new ship when there is cash, and refuses without', () => {
    expect(() => buyNewShip(game(), 'rotterdam', 'mpp', 'Uusi')).toThrow('Kassa ei riitä')
    const s = buyNewShip({ ...game(), money: 20_000_000 }, 'rotterdam', 'mpp', 'Uusi')
    expect(s.ships).toHaveLength(2)
    expect(s.ships[1]).toMatchObject({ name: 'Uusi', typeId: 'mpp', portId: 'rotterdam', condition: 100 })
    expect(s.money).toBe(20_000_000 - getShipType('mpp').price)
  })

  it('sells new ships only at the big hubs', () => {
    expect(() => buyNewShip({ ...game(), money: 1e9 }, 'mombasa', 'coaster', 'X')).toThrow('ei myydä')
  })

  it('lists used ships monthly and removes bought ones', () => {
    const s0 = { ...game(), money: 1e9 }
    const list = usedListings(s0, 'rotterdam')
    expect(list.length).toBe(3)
    const s1 = buyUsedShip(s0, list[0].id, '')
    expect(s1.ships[1].condition).toBe(list[0].condition)
    expect(usedListings(s1, 'rotterdam').map((l) => l.id)).not.toContain(list[0].id)
    expect(usedListings({ ...s1, day: 30 }, 'rotterdam')).toHaveLength(3)
  })

  it('sells ships at condition-based value but never the last one', () => {
    expect(() => sellShip(game(), 's1')).toThrow('viimeistä')
    const s = buyNewShip({ ...game(), money: 5_000_000 }, 'rotterdam', 'coaster', 'B')
    const value = shipValue(s.ships[0])
    expect(value).toBe(3_200_000)
    const sold = sellShip(s, 's1')
    expect(sold.ships.map((x) => x.id)).toEqual(['s2'])
    expect(sold.money).toBe(s.money + value)
  })
})

describe('condition and repairs', () => {
  it('a worn ship is slower and thirstier', () => {
    const s = game()
    const fresh = planVoyage(s, 's1', 'newyork')
    s.ships[0].condition = 40
    const worn = planVoyage(s, 's1', 'newyork')
    expect(worn.days).toBeGreaterThan(fresh.days)
    expect(worn.fuelNeeded).toBeGreaterThan(fresh.fuelNeeded)
  })

  it('repairs take days in dock and restore condition', () => {
    let s = game()
    s.ships[0].condition = 60
    const q = repairQuote(s.ships[0])
    expect(q.points).toBe(40)
    s = startRepair(s, 's1')
    expect(s.ledger.repairs).toBe(q.cost)
    expect(() => depart(s, 's1', 'hamburg')).toThrow('telakalla')
    s = days(s, q.days)
    expect(s.ships[0].dockUntil).toBeNull()
    expect(s.ships[0].condition).toBe(100)
  })
})

describe('bank', () => {
  it('lends against the fleet and charges monthly interest', () => {
    let s = game()
    expect(creditLimit(s)).toBe(Math.round((fleetValue(s) * 0.6 + 500_000) / 10000) * 10000)
    expect(() => borrow(s, creditLimit(s) + 1)).toThrow('enintään')
    s = borrow(s, 1_000_000)
    expect(s.loan).toBe(1_000_000)
    expect(monthlyInterest(s)).toBe(7500)
    const before = s.ledger.interest
    s = days(s, 30)
    expect(s.ledger.interest - before).toBe(7500)
    s = repay(s, 400_000)
    expect(s.loan).toBe(600_000)
  })

  it('covers an overdraft at month end, or goes bankrupt', () => {
    let s = { ...game(), money: -100_000, day: 29 }
    s = advanceDay(s)
    expect(s.money).toBeGreaterThanOrEqual(0)
    expect(s.loan).toBeGreaterThan(0)
    expect(s.bankrupt).toBe(false)

    let broke = { ...game(), money: -100_000_000, day: 29 }
    broke = advanceDay(broke)
    expect(broke.bankrupt).toBe(true)
    expect(advanceDay(broke)).toBe(broke)
    expect(creditAvailable(broke)).toBeGreaterThanOrEqual(0)
  })
})

describe('save v2 → v3', () => {
  it('adds bank and shipyard fields', () => {
    const v2 = {
      game: 'minunpoc',
      version: 2,
      savedAt: '',
      state: {
        ...newGame('A', 'helsinki', 'B'),
        ledger: { revenue: 1, fuel: 0, harbour: 0, canal: 0, running: 0 },
        ships: [{ id: 's1', name: 'X', typeId: 'coaster', portId: 'helsinki', fuel: 1, condition: 90, voyage: null }],
      },
    }
    const s = parseSave(JSON.stringify(v2)).state
    expect(s.loan).toBe(0)
    expect(s.ships[0].dockUntil).toBeNull()
    expect(s.ledger.revenue).toBe(1)
    expect(s.ledger.interest).toBe(0)
  })
})
