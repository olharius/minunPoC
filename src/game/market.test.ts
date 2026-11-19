import { describe, expect, it } from 'vitest'
import { newGame } from './newGame'
import { getCargo, portOffers } from './market'
import { monthNews } from './news'
import { PORTS } from '../data/ports'
import { TRADE } from '../data/trade'
import type { Contract, GameState } from './types'

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

describe('trade-based offers', () => {
  // Many weeks of boards from one port, to see what it typically ships.
  const sample = (portId: string, weeks = 60): Contract[] =>
    Array.from({ length: weeks }, (_, w) => portOffers({ ...game(w * 7 + 1), seed: 3 }, portId)).flat()
  const share = (offers: Contract[], ids: string[]) => offers.filter((o) => ids.includes(o.cargoId)).length / offers.length

  it('has a trade profile for every port, naming only real cargo', () => {
    for (const p of PORTS) {
      const t = TRADE[p.id]
      expect(t, p.id).toBeDefined()
      for (const id of [...Object.keys(t.exports), ...Object.keys(t.imports)]) expect(() => getCargo(id)).not.toThrow()
    }
  })

  it('offers more oil from oil countries', () => {
    expect(share(sample('dubai'), ['crude-oil'])).toBeGreaterThan(3 * share(sample('helsinki'), ['crude-oil']))
  })

  it('offers more grain from grain countries', () => {
    expect(share(sample('buenosaires'), ['grain', 'soybeans'])).toBeGreaterThan(3 * share(sample('lagos'), ['grain', 'soybeans']))
  })

  it('still offers general cargo everywhere', () => {
    for (const p of PORTS) {
      const general = sample(p.id, 20).filter((o) => getCargo(o.cargoId).cargoClass === 'general')
      expect(general.length, p.id).toBeGreaterThan(20)
    }
  })

  it('sends cargo mostly to ports that import it', () => {
    const ore = sample('sydney', 120).filter((o) => o.cargoId === 'iron-ore')
    const toImporters = ore.filter((o) => ['shanghai', 'yokohama', 'rotterdam', 'hamburg', 'genoa'].includes(o.to)).length
    expect(toImporters / ore.length).toBeGreaterThan(0.5)
  })
})
