import type { GameState, LogEntry, OwnedShip } from './types'

// Small helpers shared by the rule modules (sim, fleet, bank). Actions copy
// the state with `clone` and then change the copy, so the old state is never
// mutated and React re-renders and autosave keep working.

/** How many log entries a save keeps. */
export const LOG_LIMIT = 80

export function clone(state: GameState): GameState {
  return structuredClone(state)
}

/** Add an entry dated today to the top of the log. Mutates `s`. */
export function addLog(s: GameState, e: Omit<LogEntry, 'day'>) {
  s.log = [{ day: s.day, ...e }, ...s.log].slice(0, LOG_LIMIT)
}

/** The ship with this id; throws a Finnish error if there is none. */
export function getShip(s: GameState, id: string): OwnedShip {
  const ship = s.ships.find((x) => x.id === id)
  if (!ship) throw new Error('Tuntematon laiva.')
  return ship
}
