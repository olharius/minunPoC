import { describe, expect, it } from 'vitest'
import { newGame } from './newGame'
import { getCargo, portOffers } from './market'
import { monthNews } from './news'
import type { GameState } from './types'

const game = (day = 10): GameState => ({ ...newGame('Testi', 'rotterdam', 'Aallotar'), seed: 11, day })

describe('portOffers', () => {
  it('gives the same board for the same week', () => {
    expect(portOffers(game(8), 'rotterdam')).toEqual(portOffers(game(12), 'rotterdam'))
  })

  it('cannot be changed from outside', () => {
    const first = portOffers(game(), 'rotterdam')
    first[0].pay = 1
    first.pop()
    const again = portOffers(game(), 'rotterdam')
    expect(again[0].pay).not.toBe(1)
    expect(again.length).toBe(first.length + 1)
  })

  it('leaves out offers already taken', () => {
    const s = game()
    const [taken, ...rest] = portOffers(s, 'rotterdam')
    expect(portOffers({ ...s, takenOffers: [taken.id] }, 'rotterdam')).toEqual(rest)
  })

  it('lists the best paid offers first', () => {
    const pays = portOffers(game(), 'rotterdam').map((o) => o.pay)
    expect(pays).toEqual([...pays].sort((a, b) => b - a))
  })
})

describe('monthNews', () => {
  it('is the same every time it is asked', () => {
    expect(monthNews({ seed: 5 }, 3)).toBe(monthNews({ seed: 5 }, 3))
    expect(monthNews({ seed: 5 }, 0)).toEqual([])
  })
})

describe('getCargo', () => {
  it('finds a cargo by id and rejects unknown ones', () => {
    expect(getCargo('grain').name).toBe('Vilja')
    expect(() => getCargo('kultaa')).toThrow()
  })
})
