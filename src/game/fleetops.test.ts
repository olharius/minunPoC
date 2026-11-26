import { describe, expect, it } from 'vitest'
import { getPort } from '../data/ports'
import { captainCandidates, captainMods, hireCaptain, LEVEL_XP, shipDailyCost } from './captains'
import { planVoyage } from './economy'
import { newGame } from './newGame'
import { bestOffer, setOrders } from './orders'
import { advanceDay, depart, newlyIdle } from './sim'
import type { Captain, GameState, ShipOrders } from './types'

const game = (seed = 3): GameState => ({ ...newGame('T', 'rotterdam', 'A'), seed })
const WORLD: ShipOrders = { regions: [], pace: 'normal', autoRepair: true }
const cap = (trait: Captain['trait'], level = 1): Captain => ({ id: 'c', name: 'Testi', trait, level, xp: LEVEL_XP[level - 1] })

describe('standing orders', () => {
  it('takes the best paying offer at once', () => {
    const s = game()
    const best = bestOffer(s, s.ships[0], WORLD)!
    expect(best.profit).toBeGreaterThan(0)
    const after = setOrders(s, 's1', WORLD)
    expect(after.ships[0].voyage?.contract?.id).toBe(best.contract.id)
    expect(after.ships[0].orders).toBeDefined()
  })

  it('stays inside its area', () => {
    const area: ShipOrders = { regions: ['Pohjois-Eurooppa'], pace: 'eco', autoRepair: true }
    const after = setOrders(game(), 's1', area)
    const v = after.ships[0].voyage
    if (v) expect(getPort(v.to).region).toBe('Pohjois-Eurooppa')
    else expect(after.ships[0].orders?.waitingSince).toBe(0)
  })

  it('sails back into the area from outside it', () => {
    const s = { ...newGame('T', 'singapore', 'A'), seed: 3 }
    let after = setOrders(s, 's1', { regions: ['Välimeri'], pace: 'normal', autoRepair: false })
    for (let i = 0; i < 8 && !after.ships[0].voyage; i++) after = advanceDay(after)
    expect(getPort(after.ships[0].voyage!.to).region).toBe('Välimeri')
  })

  it('goes to dry dock when worn', () => {
    const s = game()
    s.ships[0].condition = 40
    const after = setOrders(s, 's1', WORLD)
    expect(after.ships[0].dockUntil).not.toBeNull()
  })

  it('does not ask the player about automated ships', () => {
    const s = game()
    const sailing = setOrders(depart(s, 's1', 'hamburg'), 's1', WORLD)
    let next = sailing
    for (let i = 0; i < 10 && next.ships[0].voyage?.to === 'hamburg'; i++) next = advanceDay(next)
    expect(newlyIdle(sailing, next)).toEqual([])
  })

  it('turns off', () => {
    const s = setOrders(game(), 's1', WORLD)
    expect(setOrders(s, 's1', null).ships[0].orders).toBeUndefined()
  })
})

describe('captains', () => {
  it('are hired once, for a fee, and cost a wage', () => {
    const s = game()
    const list = captainCandidates(s, 'rotterdam')
    expect(list.length).toBe(3)
    const after = hireCaptain(s, 's1', list[0].id)
    expect(after.ships[0].captain?.id).toBe(list[0].id)
    expect(after.money).toBeLessThan(s.money)
    expect(captainCandidates(after, 'rotterdam').map((c) => c.id)).not.toContain(list[0].id)
    expect(shipDailyCost(after.ships[0])).toBeGreaterThan(shipDailyCost(s.ships[0]))
    expect(captainCandidates(s, 'mombasa')).toEqual([])
  })

  it('speed up, save fuel and make the voyage plan', () => {
    const s = game()
    const base = planVoyage(s, 's1', 'newyork')
    s.ships[0].captain = cap('navigator', 5)
    expect(planVoyage(s, 's1', 'newyork').days).toBeLessThan(base.days)
    s.ships[0].captain = cap('saver', 5)
    expect(planVoyage(s, 's1', 'newyork').fuelNeeded).toBeLessThan(base.fuelNeeded)
    expect(captainMods({ captain: cap('trader', 3) }).payBonus).toBeCloseTo(0.06)
  })

  it('gain experience at sea and level up', () => {
    let s = game()
    s.ships[0].captain = cap('mechanic', 1)
    s.ships[0].captain.xp = LEVEL_XP[1] - 2
    s = depart(s, 's1', 'newyork')
    for (let i = 0; i < 4; i++) s = advanceDay({ ...s, pendingEvent: null })
    expect(s.ships[0].captain!.level).toBe(2)
  })

  it('trader earns extra pay on delivery', () => {
    let s = game()
    s.ships[0].captain = cap('trader', 5)
    const contract = { id: 'c', cargoId: 'general-goods', tonnes: 1000, from: 'rotterdam', to: 'hamburg', pay: 100_000, deadlineDay: 30 }
    s = depart(s, 's1', 'hamburg', contract)
    for (let i = 0; i < 10 && s.ships[0].voyage; i++) s = advanceDay(s)
    expect(s.ledger.revenue).toBe(110_000)
  })
})
