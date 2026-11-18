import type { GameState, OwnedShip } from './types'

// Ship names must be unique within the fleet. Repeated names get a Roman
// numeral: "Ocean Pride", "Ocean Pride II", "Ocean Pride III" ...
// A bare name and the same name with "I" count as the same name.

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

export function toRoman(n: number): string {
  let out = ''
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}

function fromRoman(s: string): number {
  let n = 0
  let rest = s
  for (const [v, sym] of ROMAN) {
    while (rest.startsWith(sym)) {
      n += v
      rest = rest.slice(sym.length)
    }
  }
  // Only accept canonical numerals up to 50, so words like "MIX" or "DC" stay part of the name.
  return rest === '' && n <= 50 && toRoman(n) === s ? n : 0
}

/** Splits "Ocean Pride III" into base "Ocean Pride" and number 3 (1 when there is no numeral). */
export function splitName(name: string): { base: string; num: number } {
  const clean = name.trim().replace(/\s+/g, ' ')
  const m = /^(.*\S)\s+([IVXLCDM]+)$/i.exec(clean)
  if (m) {
    const num = fromRoman(m[2].toUpperCase())
    if (num > 0) return { base: m[1], num }
  }
  return { base: clean, num: 1 }
}

export function withNumeral(base: string, num: number): string {
  return num <= 1 ? base : `${base} ${toRoman(num)}`
}

/** Comparison key: case-insensitive, whitespace-normalised, "X" == "X I". */
export function nameKey(name: string): string {
  const { base, num } = splitName(name)
  return `${base.toLocaleLowerCase('fi')}#${num}`
}

export function fleetNameKeys(state: GameState, exceptShipId?: string): Set<string> {
  return new Set(state.ships.filter((s) => s.id !== exceptShipId).map((s) => nameKey(s.name)))
}

export function isNameTaken(state: GameState, name: string, exceptShipId?: string): boolean {
  return fleetNameKeys(state, exceptShipId).has(nameKey(name))
}

/** Returns `name` if it is free, otherwise the same base with the lowest free numeral (II, III, ...). */
export function uniqueName(name: string, takenKeys: Set<string>): string {
  const { base } = splitName(name)
  if (!takenKeys.has(nameKey(name))) return name.trim().replace(/\s+/g, ' ')
  for (let n = 2; ; n++) {
    const candidate = withNumeral(base, n)
    if (!takenKeys.has(nameKey(candidate))) return candidate
  }
}

/** First free name from the list; once all are used, continues with II, then III, and so on. */
export function suggestName(ideas: string[], takenKeys: Set<string>): string {
  for (let n = 1; ; n++) {
    for (const idea of ideas) {
      const candidate = withNumeral(idea, n)
      if (!takenKeys.has(nameKey(candidate))) return candidate
    }
  }
}

/** Renames later ships that share a name with an earlier one (used when loading old saves). */
export function dedupeShipNames(ships: OwnedShip[]): OwnedShip[] {
  const taken = new Set<string>()
  return ships.map((ship) => {
    const key = nameKey(ship.name)
    const name = taken.has(key) ? uniqueName(ship.name, taken) : ship.name
    taken.add(nameKey(name))
    return name === ship.name ? ship : { ...ship, name }
  })
}
