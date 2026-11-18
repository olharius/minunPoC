import { describe, expect, it } from 'vitest'
import { buyNewShip, buyUsedShip, usedListings } from './fleet'
import { dedupeShipNames, nameKey, splitName, suggestName, toRoman, uniqueName } from './names'
import { newGame } from './newGame'
import { parseSave, toSaveFile } from './save'

describe('ship names', () => {
  it('writes and reads Roman numerals', () => {
    expect([1, 2, 3, 4, 9, 14, 40].map(toRoman)).toEqual(['I', 'II', 'III', 'IV', 'IX', 'XIV', 'XL'])
    expect(splitName('Ocean Pride III')).toEqual({ base: 'Ocean Pride', num: 3 })
    expect(splitName('  Ocean   Pride ')).toEqual({ base: 'Ocean Pride', num: 1 })
    expect(splitName('Kotka MIX')).toEqual({ base: 'Kotka MIX', num: 1 })
  })

  it('treats case, spacing and a bare "I" as the same name', () => {
    expect(nameKey('ocean pride')).toBe(nameKey('Ocean  Pride I'))
    expect(nameKey('aallotar ii')).toBe(nameKey('Aallotar II'))
    expect(nameKey('Ocean Pride')).not.toBe(nameKey('Ocean Pride II'))
  })

  it('numbers repeated names', () => {
    const taken = new Set(['Ocean Pride', 'Ocean Pride II'].map(nameKey))
    expect(uniqueName('Ocean Pride', taken)).toBe('Ocean Pride III')
    expect(uniqueName('Sea Falcon', taken)).toBe('Sea Falcon')
    expect(suggestName(['A', 'B'], new Set(['A', 'B', 'A II'].map(nameKey)))).toBe('B II')
  })

  it('renames duplicates in old saves', () => {
    const g = newGame('Testi Oy', 'rotterdam', 'Aallotar')
    const copy = { ...g.ships[0], id: 'x1' }
    const copy2 = { ...g.ships[0], id: 'x2', name: 'aallotar' }
    g.ships = [...g.ships, copy, copy2]
    const loaded = parseSave(JSON.stringify(toSaveFile(g))).state
    expect(loaded.ships.map((s) => s.name)).toEqual(['Aallotar', 'Aallotar II', 'aallotar III'])
    expect(dedupeShipNames(loaded.ships)).toEqual(loaded.ships)
  })

  it('refuses to buy a ship with a name already in the fleet', () => {
    const g = { ...newGame('Testi Oy', 'rotterdam', 'Aallotar'), money: 1e9 }
    expect(() => buyNewShip(g, 'rotterdam', g.ships[0].typeId, 'AALLOTAR')).toThrow('jo laiva')
    const after = buyNewShip(g, 'rotterdam', g.ships[0].typeId, 'Aallotar II')
    expect(after.ships.map((s) => s.name)).toEqual(['Aallotar', 'Aallotar II'])
  })

  it('suggests unique names for used ships', () => {
    const g = { ...newGame('Testi Oy', 'rotterdam', 'Aallotar'), money: 1e9 }
    for (let seed = 1; seed < 200; seed++) {
      const s = { ...g, seed }
      const names = usedListings(s, 'rotterdam').map((l) => nameKey(l.name))
      expect(new Set(names).size).toBe(names.length)
    }
    const l = usedListings(g, 'rotterdam')[0]
    const bought = buyUsedShip(g, l.id, '')
    expect(bought.ships[1].name).toBe(l.name)
    expect(usedListings(bought, 'rotterdam').map((x) => nameKey(x.name))).not.toContain(nameKey(l.name))
  })
})
