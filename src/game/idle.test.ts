import { describe, expect, it } from 'vitest'
import { newGame } from './newGame'
import { newlyIdle } from './sim'
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
