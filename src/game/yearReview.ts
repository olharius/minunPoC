import { getMilestone } from './milestones'
import { netWorth } from './fleet'
import { dateOfDay } from './newGame'
import type { GameState, Ledger, YearReport, YearSnapshot } from './types'

// The year review: at the turn of each calendar year, compare the company
// with where it stood when the year began.

export function yearOfDay(s: Pick<GameState, 'startDate'>, day: number): number {
  return dateOfDay(s, day).getUTCFullYear()
}

export function ledgerCosts(l: Ledger): number {
  return l.fuel + l.harbour + l.canal + l.running + l.repairs + l.interest + l.incidents + l.penalties
}

export function snapshot(s: GameState, year: number): YearSnapshot {
  return {
    year,
    netWorth: netWorth(s),
    ledger: { ...s.ledger },
    deliveries: s.stats.deliveries,
    onTime: s.stats.onTime,
    shipEarned: Object.fromEntries(s.ships.map((x) => [x.id, x.earned ?? 0])),
  }
}

/** Close the year if today is the first day of a new one. Mutates `s`; returns the report. */
export function closeYear(s: GameState): YearReport | null {
  const year = yearOfDay(s, s.day)
  if (year === s.yearStart.year) return null
  const y = s.yearStart
  const l = s.ledger
  let best: YearReport['bestShip'] = null
  for (const ship of s.ships) {
    const earned = (ship.earned ?? 0) - (y.shipEarned[ship.id] ?? 0)
    if (earned > 0 && (!best || earned > best.earned)) best = { name: ship.name, earned }
  }
  const startDay = s.day - (dateOfDay(s, s.day).getTime() - Date.UTC(y.year, 0, 1)) / 86_400_000
  const report: YearReport = {
    year: y.year,
    revenue: l.revenue + l.awards - y.ledger.revenue - y.ledger.awards,
    costs: ledgerCosts(l) - ledgerCosts(y.ledger),
    netWorthStart: y.netWorth,
    netWorthEnd: netWorth(s),
    deliveries: s.stats.deliveries - y.deliveries,
    onTime: s.stats.onTime - y.onTime,
    bestShip: best,
    milestones: s.milestones.filter((m) => m.day >= startDay).map((m) => getMilestone(m.id)?.title ?? m.id),
    ships: s.ships.length,
  }
  s.yearReports = [...s.yearReports, report].slice(-30)
  s.yearStart = snapshot(s, year)
  return report
}

/** A one-line verdict on the year, from how much the company grew. */
export function verdict(r: YearReport): string {
  const growth = r.netWorthStart > 0 ? (r.netWorthEnd - r.netWorthStart) / r.netWorthStart : 0
  if (growth >= 0.5) return 'Loistava vuosi! Yhtiö kasvoi rajusti.'
  if (growth >= 0.15) return 'Hyvä vuosi. Kasvu jatkuu vahvana.'
  if (growth >= 0) return 'Kohtuullinen vuosi. Yhtiö kasvoi hieman.'
  if (growth >= -0.15) return 'Vaikea vuosi. Yhtiön arvo laski.'
  return 'Raskas vuosi. Nyt tarvitaan suunnanmuutos.'
}
