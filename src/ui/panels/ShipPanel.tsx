import { getPort } from '../../data/ports'
import { getShipType } from '../../data/shipTypes'
import { fmtDate, fmtMoney, fmtNum } from '../../game/format'
import { latePenalty, penaltyPerDay } from '../../game/economy'
import { getCargo } from '../../game/market'
import { currentDate } from '../../game/newGame'
import type { GameState } from '../../game/types'
import { activeHold, holdText, voyageProgress } from '../../game/voyage'

interface Props {
  state: GameState
  shipId: string
  time: number
  onClose: () => void
  onSelectPort: (id: string) => void
}

export function ShipPanel({ state, shipId, time, onClose, onSelectPort }: Props) {
  const ship = state.ships.find((s) => s.id === shipId)
  if (!ship) return null
  const t = getShipType(ship.typeId)
  const v = ship.voyage
  const dateOf = (day: number) => fmtDate(currentDate({ ...state, day }))
  const progress = v ? voyageProgress(v, time) : 0
  const hold = v ? activeHold(v, time) : null

  return (
    <div>
      <div className="panel-head">
        <h2>{ship.name}</h2>
        <button className="close" onClick={onClose} aria-label="Sulje">
          ×
        </button>
      </div>
      <div className="muted">{t.name}</div>
      <p className="hint">{t.description}</p>

      {v ? (
        <div className="voyage-box">
          <div className="route-line">
            <button className="link" onClick={() => onSelectPort(v.from)}>
              {getPort(v.from).name}
            </button>
            <span>→</span>
            <button className="link" onClick={() => onSelectPort(v.to)}>
              {getPort(v.to).name}
            </button>
          </div>
          {hold && <div className="hold-note">{hold.reason === 'pirates' ? '☠' : '🔧'} {holdText(hold, time)}</div>}
          <div className="progress">
            <div style={{ width: `${progress * 100}%` }} />
          </div>
          <dl className="facts">
            <dt>Lähti</dt>
            <dd>{dateOf(v.departDay)}</dd>
            <dt>Saapuu</dt>
            <dd>{dateOf(Math.ceil(v.arriveDay))}</dd>
            {v.contract ? (
              <>
                <dt>Lasti</dt>
                <dd>
                  {fmtNum(v.contract.tonnes)} t {getCargo(v.contract.cargoId).name.toLowerCase()}
                </dd>
                <dt>Rahti</dt>
                <dd>{fmtMoney(v.contract.pay)}</dd>
                <dt>Määräaika</dt>
                <dd className={Math.ceil(v.arriveDay) > v.contract.deadlineDay ? 'neg' : ''}>
                  {dateOf(v.contract.deadlineDay)}
                  {v.contract.express && ' · Express'}
                </dd>
                {Math.ceil(v.arriveDay) > v.contract.deadlineDay && (
                  <>
                    <dt>Sopimussakko</dt>
                    <dd className="neg">
                      {Math.ceil(v.arriveDay) - v.contract.deadlineDay} pv × {fmtMoney(penaltyPerDay(v.contract))} ={' '}
                      {fmtMoney(latePenalty(v.contract, Math.ceil(v.arriveDay) - v.contract.deadlineDay))}
                    </dd>
                  </>
                )}
              </>
            ) : (
              <>
                <dt>Lasti</dt>
                <dd>Ei lastia</dd>
              </>
            )}
          </dl>
        </div>
      ) : (
        <p>
          Satamassa:{' '}
          <button className="link" onClick={() => onSelectPort(ship.portId!)}>
            {getPort(ship.portId!).name}
          </button>
          . Avaa satama ottaaksesi rahdin.
        </p>
      )}

      <h3>Tekniset tiedot</h3>
      <dl className="facts">
        <dt>Lastitila</dt>
        <dd>{fmtNum(t.capacity)} t</dd>
        <dt>Nopeus</dt>
        <dd>{t.speed} solmua</dd>
        <dt>Polttoaine</dt>
        <dd>
          {fmtNum(ship.fuel)} / {fmtNum(t.fuelCapacity)} t
        </dd>
        <dt>Kulutus</dt>
        <dd>{t.fuelPerDay} t/päivä</dd>
        <dt>Päiväkulut</dt>
        <dd>{fmtMoney(t.dailyCost)}</dd>
        <dt>Kunto</dt>
        <dd>{Math.round(ship.condition)} %</dd>
      </dl>
    </div>
  )
}
