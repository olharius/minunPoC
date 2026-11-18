import { fmtDate, fmtMoney } from '../../game/format'
import { currentDate } from '../../game/newGame'
import type { GameState } from '../../game/types'

const ICON: Record<string, string> = {
  arrival: '⚓',
  delivery: '✅',
  late: '⏰',
  departure: '🚢',
  info: '•',
  warning: '⚠️',
}

export function LogList({ state, limit = 12 }: { state: GameState; limit?: number }) {
  return (
    <ul className="log">
      {state.log.slice(0, limit).map((e, i) => (
        <li key={`${e.day}-${i}`} className={`log-${e.kind}`}>
          <span className="log-icon">{ICON[e.kind]}</span>
          <span className="log-text">
            <span className="log-date">{fmtDate(currentDate({ ...state, day: e.day }))}</span> {e.text}
          </span>
          {e.amount !== undefined && <span className={`log-amount ${e.amount < 0 ? 'neg' : 'pos'}`}>{fmtMoney(e.amount)}</span>}
        </li>
      ))}
    </ul>
  )
}
