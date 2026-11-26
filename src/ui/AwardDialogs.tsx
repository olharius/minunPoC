import { fmtMoney, fmtNum } from '../game/format'
import { getMilestone } from '../game/milestones'
import type { GameState } from '../game/types'
import { verdict } from '../game/yearReview'

/** Congratulations for milestones reached today. */
export function MilestoneDialog({ ids, onClose, onShowGoals }: { ids: string[]; onClose: () => void; onShowGoals: () => void }) {
  const list = ids.map(getMilestone).filter((m) => !!m)
  return (
    <div className="modal-back">
      <div className="modal" role="alertdialog" aria-modal="true">
        <p className="trophy">🏆</p>
        <h2>{list.length === 1 ? 'Virstanpylväs saavutettu!' : `${list.length} virstanpylvästä saavutettu!`}</h2>
        <dl className="facts money">
          {list.map((m) => (
            <div key={m.id} style={{ display: 'contents' }}>
              <dt>
                <strong>{m.title}</strong>
                <br />
                <small className="muted">{m.text}</small>
              </dt>
              <dd className="pos">+{fmtMoney(m.reward)}</dd>
            </div>
          ))}
        </dl>
        <div className="row end">
          <button onClick={onShowGoals}>Näytä tavoitteet</button>
          <button className="primary" onClick={onClose} autoFocus>
            Jatka
          </button>
        </div>
      </div>
    </div>
  )
}

/** The year in review: money, growth, deliveries and the best ship. */
export function YearReviewDialog({ state, year, onClose }: { state: GameState; year: number; onClose: () => void }) {
  const r = state.yearReports.find((x) => x.year === year)
  if (!r) return null
  const profit = r.revenue - r.costs
  const growth = r.netWorthStart > 0 ? Math.round(((r.netWorthEnd - r.netWorthStart) / r.netWorthStart) * 100) : 0
  const prev = state.yearReports.find((x) => x.year === year - 1)
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Vuosikatsaus {r.year}</h2>
        <p className="verdict">{verdict(r)}</p>
        <dl className="facts money">
          <dt>Tulot (rahdit ja palkinnot)</dt>
          <dd className="pos">{fmtMoney(r.revenue)}</dd>
          <dt>Kulut</dt>
          <dd>{fmtMoney(-r.costs)}</dd>
          <dt className="total">Vuoden tulos</dt>
          <dd className={`total ${profit < 0 ? 'neg' : 'pos'}`}>{fmtMoney(profit)}</dd>
          {prev && (
            <>
              <dt>Edellinen vuosi</dt>
              <dd className="muted">{fmtMoney(prev.revenue - prev.costs)}</dd>
            </>
          )}
        </dl>
        <dl className="facts">
          <dt>Yhtiön arvo</dt>
          <dd>
            {fmtMoney(r.netWorthStart)} → {fmtMoney(r.netWorthEnd)}{' '}
            <span className={growth < 0 ? 'neg' : 'pos'}>
              ({growth >= 0 ? '+' : ''}
              {growth} %)
            </span>
          </dd>
          <dt>Laivoja</dt>
          <dd>{r.ships}</dd>
          <dt>Toimituksia</dt>
          <dd>
            {fmtNum(r.deliveries)}
            {r.deliveries > 0 && `, joista ajallaan ${Math.round((r.onTime / r.deliveries) * 100)} %`}
          </dd>
          {r.bestShip && (
            <>
              <dt>Paras laiva</dt>
              <dd>
                {r.bestShip.name} ({fmtMoney(r.bestShip.earned)} rahtituloja)
              </dd>
            </>
          )}
          {r.milestones.length > 0 && (
            <>
              <dt>Virstanpylväät</dt>
              <dd>{r.milestones.join(', ')}</dd>
            </>
          )}
        </dl>
        <div className="row end">
          <button className="primary" onClick={onClose} autoFocus>
            Jatka
          </button>
        </div>
      </div>
    </div>
  )
}
