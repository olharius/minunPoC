import { getPort } from '../data/ports'
import { penaltyPerDay } from '../game/economy'
import { eventOutlook, type Outcome } from '../game/events'
import { fmtDay, fmtMoney, fmtNum } from '../game/format'
import { getCargo } from '../game/market'
import type { GameState } from '../game/types'

interface Props {
  state: GameState
  onChoose: (optionId: string) => void
}

/** A decision at sea, with the ship's job and what each choice means for its schedule. */
export function EventDialog({ state, onChoose }: Props) {
  const ev = state.pendingEvent!
  const look = eventOutlook(state)
  const dateOf = (day: number) => fmtDay(state, day)
  const v = look?.ship.voyage
  const c = v?.contract

  /** One line on schedule and money for an outcome. */
  const line = (o: Outcome) => {
    const parts: string[] = []
    const shift = o.arriveDay - Math.ceil(v?.arriveDay ?? o.arriveDay)
    parts.push(`Perillä ${dateOf(o.arriveDay)}${shift > 0 ? ` (+${shift} pv)` : shift < 0 ? ` (${shift} pv)` : ''}`)
    if (o.lateDays !== null) parts.push(o.lateDays > 0 ? `myöhässä ${o.lateDays} pv` : 'ajoissa')
    const money: string[] = []
    if (o.cost) money.push(`kulut ${fmtMoney(o.cost)}`)
    if (o.penalty) money.push(`sopimussakko ${fmtMoney(o.penalty)}`)
    if (o.cargoLoss) money.push(`lastivahinko −${fmtMoney(o.cargoLoss)}`)
    if (o.fuel) money.push(`lisäpolttoaine noin ${fmtMoney(o.fuel)}`)
    if (o.reward) money.push(`${ev.kind === 'rush' ? 'bonus' : 'palkkio'} +${fmtMoney(o.reward)}`)
    return { text: parts.join(' · '), money: money.join(' · '), bad: (o.lateDays ?? 0) > 0 }
  }

  return (
    <div className="modal-back">
      <div className="modal" role="alertdialog" aria-modal="true">
        <h2>{ev.title}</h2>
        <p>{ev.text}</p>
        {look && v && (
          <div className="event-job">
            <div className="event-job-head">
              <strong>{look.ship.name}</strong> · {getPort(v.from).name} → {getPort(v.to).name}
            </div>
            {c ? (
              <>
                <div>
                  {c.express && <span className="badge express">Express</span>} {fmtNum(c.tonnes)} t {getCargo(c.cargoId).name.toLowerCase()} ·
                  rahti {fmtMoney(c.pay)}
                </div>
                <div>
                  Määräaika {dateOf(c.deadlineDay)} · nyt arvio {dateOf(Math.ceil(v.arriveDay))}
                  {Math.ceil(v.arriveDay) > c.deadlineDay
                    ? ` (myöhässä ${Math.ceil(v.arriveDay) - c.deadlineDay} pv)`
                    : ` (${c.deadlineDay - Math.ceil(v.arriveDay)} pv pelivaraa)`}
                </div>
                <div className="muted">Sopimussakko {fmtMoney(penaltyPerDay(c))} / myöhästymispäivä</div>
              </>
            ) : (
              <div>Ei lastia, perillä {dateOf(Math.ceil(v.arriveDay))}</div>
            )}
          </div>
        )}
        <div className="event-options">
          {ev.options.map((o) => {
            const ol = look?.options.find((x) => x.optionId === o.id)
            const sure = ol && line(ol.sure)
            const risk = ol?.risk && line(ol.risk.outcome)
            return (
              <button key={o.id} onClick={() => onChoose(o.id)}>
                <strong>{o.label}</strong>
                <br />
                <small>{o.detail}</small>
                {sure && (
                  <span className={`outlook${sure.bad ? ' late' : ''}`}>
                    {risk ? 'Jos kaikki menee hyvin: ' : ''}
                    {sure.text}
                    {sure.money && ` · ${sure.money}`}
                  </span>
                )}
                {risk && ol?.risk && (
                  <span className={`outlook${risk.bad ? ' late' : ''} risky`}>
                    {ev.kind === 'pirates' ? 'Jos laiva kaapataan' : ev.kind === 'medical' ? 'Jos tila pahenee' : 'Jos myrsky vaurioittaa'} ({Math.round(ol.risk.chance * 100)} %): {risk.text}
                    {risk.money && ` · ${risk.money}`}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
