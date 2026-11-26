import type { Voyage, VoyageHold } from './types'

// Where a ship is along its route. A voyage moves at an even pace from an
// anchor point (the departure, or the last time an event changed the pace) to
// the destination, except during holds, when the ship stays where it is.

function anchorOf(v: Voyage) {
  return v.anchor ?? { day: v.departDay, t: 0 }
}

/** Days of hold time inside [a, b]. */
function heldBetween(holds: VoyageHold[] | undefined, a: number, b: number): number {
  let sum = 0
  for (const h of holds ?? []) sum += Math.max(0, Math.min(b, h.until) - Math.max(a, h.from))
  return sum
}

/** Share of the route sailed at `time`, 0..1. */
export function voyageProgress(v: Voyage, time: number): number {
  const { day: d0, t: t0 } = anchorOf(v)
  const sailTime = v.arriveDay - d0 - heldBetween(v.holds, d0, Infinity)
  if (sailTime <= 0) return time >= v.arriveDay ? 1 : t0
  const sailed = time - d0 - heldBetween(v.holds, d0, time)
  return Math.min(1, Math.max(0, t0 + ((1 - t0) * sailed) / sailTime))
}

/** The hold the ship is in at `time`, if any. */
export function activeHold(v: Voyage, time: number): VoyageHold | null {
  return (v.holds ?? []).find((h) => time >= h.from && time < h.until) ?? null
}

/** Days of `[a, b]` the ship actually spent moving (for fuel). */
export function sailingTime(v: Voyage, a: number, b: number): number {
  const end = Math.min(b, v.arriveDay)
  if (end <= a) return 0
  return end - a - heldBetween(v.holds, a, end)
}

/** Short Finnish status for a held ship, e.g. "Korjaus käynnissä, 3 pv". */
export function holdText(h: VoyageHold, time: number): string {
  const left = Math.max(1, Math.ceil(h.until - time))
  const what =
    h.reason === 'pirates' ? 'Merirosvojen hallussa' : h.reason === 'service' ? 'Huoltoalus korjaa konetta' : h.reason === 'rescue' ? 'Pelastustehtävä' : h.reason === 'ice' ? 'Jäissä' : 'Korjaus käynnissä'
  return `${what}, ${left} pv`
}

/**
 * Change arrival by `days` (negative = earlier) and spread the change over the
 * rest of the route: the ship keeps moving, just slower or faster (a detour, a
 * tailwind). The ship stays where it is on the map at `day`.
 */
export function shiftArrival(v: Voyage, day: number, days: number) {
  const t = voyageProgress(v, day)
  const held = heldBetween(v.holds, day, Infinity)
  v.arriveDay = Math.max(day + held + 0.5, v.arriveDay + days)
  v.anchor = { day, t }
}

/** Stop the ship where it is for `days`, then continue at the same pace. */
export function holdShip(v: Voyage, day: number, days: number, reason: VoyageHold['reason']) {
  const t = voyageProgress(v, day)
  v.anchor = { day, t }
  v.holds = [...(v.holds ?? []), { from: day, until: day + days, reason }]
  v.arriveDay += days
}
