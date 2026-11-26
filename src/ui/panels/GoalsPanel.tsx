import { fmtDay, fmtMoney, fmtNum } from '../../game/format'
import { MILESTONES } from '../../game/milestones'
import type { GameState } from '../../game/types'

/** Milestones: reached ones with their date, the rest with progress bars, nearest first. */
export function GoalsPanel({ state }: { state: GameState }) {
  const done = new Map(state.milestones.map((m) => [m.id, m.day]))
  const rows = MILESTONES.map((m) => {
    const [now, target] = m.progress(state)
    return { m, now: Math.min(now, target), target, share: Math.min(1, now / target), day: done.get(m.id) }
  })
  const open = rows.filter((r) => r.day === undefined).sort((a, b) => b.share - a.share)
  const reached = rows.filter((r) => r.day !== undefined).sort((a, b) => b.day! - a.day!)
  const big = (n: number) => (n >= 1e6 ? `${fmtNum(n / 1e6)} M$` : fmtNum(n))

  return (
    <div>
      <p className="muted">
        Saavutettu {reached.length} / {MILESTONES.length}. Jokaisesta virstanpylväästä saa rahapalkinnon.
      </p>
      <ul className="goal-list">
        {open.map(({ m, now, target, share }) => (
          <li key={m.id}>
            <div className="goal-head">
              <span>{m.title}</span>
              <span className="goal-reward">{fmtMoney(m.reward)}</span>
            </div>
            <div className="muted">{m.text}</div>
            <div className="progress" aria-hidden="true">
              <div style={{ width: `${Math.round(share * 100)}%` }} />
            </div>
            <small className="muted">
              {big(now)} / {big(target)}
            </small>
          </li>
        ))}
        {reached.map(({ m, day }) => (
          <li key={m.id} className="done">
            <div className="goal-head">
              <span>🏆 {m.title}</span>
              <span className="goal-reward">{fmtDay(state, day!)}</span>
            </div>
            <div className="muted">{m.text}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
