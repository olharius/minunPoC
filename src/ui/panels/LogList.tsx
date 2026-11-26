import { fmtDay, fmtMoney } from '../../game/format'
import type { GameState, LogKind } from '../../game/types'

const ICON: Record<LogKind, string> = {
  arrival: '⚓',
  delivery: '✅',
  late: '⏰',
  departure: '🚢',
  info: '•',
  warning: '⚠️',
  bank: '🏦',
  shipyard: '🛠️',
  event: '🌊',
  news: '📰',
  award: '🏆',
}

export function LogList({ state, limit = 12 }: { state: GameState; limit?: number }) {
  return (
    <ul className="log">
      {state.log.slice(0, limit).map((e, i) => (
        <li key={`${e.day}-${i}`} className={`log-${e.kind}`}>
          <span className="log-icon">{ICON[e.kind]}</span>
          <span className="log-text">
            <span className="log-date">{fmtDay(state, e.day)}</span> {e.text}
          </span>
          {e.amount !== undefined && <span className={`log-amount ${e.amount < 0 ? 'neg' : 'pos'}`}>{fmtMoney(e.amount)}</span>}
        </li>
      ))}
    </ul>
  )
}
