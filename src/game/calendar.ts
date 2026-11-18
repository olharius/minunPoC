// Game calendar. Everything that "happens monthly" (fuel prices, news, used
// ship listings, loan interest) uses the same 30-day month.

/** Days in a game month. */
export const MONTH = 30
/** Days in a freight-market week: offers refresh this often. */
export const MARKET_WEEK = 7

export function monthOf(day: number): number {
  return Math.floor(day / MONTH)
}
