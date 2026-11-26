// Game calendar. Everything that "happens monthly" (fuel prices, news, used
// ship listings, loan interest) uses the same 30-day month.

/** Days in a game month. */
export const MONTH = 30
/** Days in a freight-market week: offers refresh this often. */
export const MARKET_WEEK = 7

export function monthOf(day: number): number {
  return Math.floor(day / MONTH)
}

/** Every game starts on this date (day 0). */
export const START_DATE = '1990-01-01'
const START_MS = Date.UTC(1990, 0, 1)
const DAY_MS = 86_400_000

/** Calendar year of a game day. */
export function yearAt(day: number): number {
  return new Date(START_MS + Math.floor(day) * DAY_MS).getUTCFullYear()
}

/** Game day of a calendar date (month 1–12). */
export function dayOfDate(year: number, month = 1): number {
  return Math.round((Date.UTC(year, month - 1, 1) - START_MS) / DAY_MS)
}
