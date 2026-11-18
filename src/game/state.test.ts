import { describe, expect, it } from 'vitest'
import { newGame } from './newGame'
import { addLog, clone, getShip, LOG_LIMIT } from './state'

describe('state helpers', () => {
  it('keeps the log to its limit, newest first', () => {
    const s = newGame('Testi', 'rotterdam', 'Aallotar')
    for (let i = 0; i < LOG_LIMIT + 5; i++) addLog(s, { kind: 'info', text: `#${i}` })
    expect(s.log).toHaveLength(LOG_LIMIT)
    expect(s.log[0].text).toBe(`#${LOG_LIMIT + 4}`)
  })

  it('clone leaves the original untouched', () => {
    const s = newGame('Testi', 'rotterdam', 'Aallotar')
    const c = clone(s)
    c.ships[0].fuel = 0
    expect(s.ships[0].fuel).toBeGreaterThan(0)
  })

  it('getShip throws for an unknown ship', () => {
    const s = newGame('Testi', 'rotterdam', 'Aallotar')
    expect(getShip(s, s.ships[0].id).name).toBe('Aallotar')
    expect(() => getShip(s, 'x')).toThrow('Tuntematon laiva.')
  })
})
