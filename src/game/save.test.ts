import { describe, expect, it } from 'vitest'
import { PORTS } from '../data/ports'
import { getShipType, SHIP_TYPES } from '../data/shipTypes'
import { distanceNm } from './geo'
import { currentDate, newGame } from './newGame'
import { parseSave, toSaveFile } from './save'

describe('save files', () => {
  it('round-trips a new game', () => {
    const g = newGame('Testi Oy', 'helsinki', 'Aallotar')
    const back = parseSave(JSON.stringify(toSaveFile(g)))
    expect(back.state).toEqual(g)
  })

  it('rejects other JSON', () => {
    expect(() => parseSave('{"foo":1}')).toThrow('ei ole tämän pelin')
    expect(() => parseSave('not json')).toThrow('kelvollinen')
  })

  it('rejects saves from a newer version', () => {
    const f = { ...toSaveFile(newGame('A', 'helsinki', 'B')), version: 999 }
    expect(() => parseSave(JSON.stringify(f))).toThrow('uudemmalla')
  })
})

describe('game data', () => {
  it('has unique port and ship ids', () => {
    expect(new Set(PORTS.map((p) => p.id)).size).toBe(PORTS.length)
    expect(new Set(SHIP_TYPES.map((t) => t.id)).size).toBe(SHIP_TYPES.length)
  })

  it('starts with a full tank in the home port', () => {
    const g = newGame('A', 'singapore', 'B')
    expect(g.ships[0].portId).toBe('singapore')
    expect(g.ships[0].fuel).toBe(getShipType(g.ships[0].typeId).fuelCapacity)
    expect(currentDate(g).toISOString().slice(0, 10)).toBe('1990-01-01')
  })

  it('computes plausible distances', () => {
    // Rotterdam–New York is about 3,300 nm great-circle.
    const d = distanceNm(51.95, 4.14, 40.67, -74.04)
    expect(d).toBeGreaterThan(3100)
    expect(d).toBeLessThan(3500)
  })
})
