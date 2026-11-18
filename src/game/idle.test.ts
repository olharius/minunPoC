import { describe, expect, it } from 'vitest'
import { newGame } from './newGame'
import { newOffers, newlyIdle } from './sim'
import type { GameState } from './types'

const game = (): GameState => ({ ...newGame('Testi', 'rotterdam', 'Aallotar'), seed: 7 })

describe('newlyIdle', () => {
  it('reports a ship whose repair just finished', () => {
    const before = game()
    before.ships[0].dockUntil = 5
    const after = structuredClone(before)
    after.ships[0].dockUntil = null
    expect(newlyIdle(before, after)).toEqual([{ shipId: before.ships[0].id, reason: 'repaired' }])
  })

  it('reports a ship that just arrived', () => {
    const before = game()
    before.ships[0].voyage = { to: 'hamburg' } as never
    before.ships[0].portId = null
    const after = game()
    expect(newlyIdle(before, after)).toEqual([{ shipId: after.ships[0].id, reason: 'arrived' }])
  })

  it('ignores ships that were already idle or are still busy', () => {
    const before = game()
    expect(newlyIdle(before, before)).toEqual([])
    const docked = game()
    docked.ships[0].dockUntil = 9
    expect(newlyIdle(docked, docked)).toEqual([])
  })
})

describe('newlyIdle on a new market week', () => {
  const atDay = (day: number): GameState => ({ ...game(), day })

  it('reports a waiting ship when its port gets new offers', () => {
    const before = atDay(6)
    const after = atDay(7)
    expect(newlyIdle(before, after)).toEqual([{ shipId: after.ships[0].id, reason: 'offers' }])
    expect(newOffers(before, after, 'rotterdam').length).toBeGreaterThan(0)
  })

  it('stays quiet within the same week', () => {
    expect(newlyIdle(atDay(7), atDay(8))).toEqual([])
  })

  it('reports an arrival on the same day only once', () => {
    const before = atDay(6)
    before.ships[0].voyage = { to: 'rotterdam' } as never
    before.ships[0].portId = null
    expect(newlyIdle(before, atDay(7))).toEqual([{ shipId: before.ships[0].id, reason: 'arrived' }])
  })

  it('ignores busy ships', () => {
    const before = atDay(6)
    before.ships[0].dockUntil = 20
    const after = atDay(7)
    after.ships[0].dockUntil = 20
    expect(newlyIdle(before, after)).toEqual([])
  })
})
