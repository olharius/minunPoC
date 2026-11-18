import { getPort } from '../../data/ports'
import { getShipType } from '../../data/shipTypes'
import { fmtCost, fmtMoney, fmtNum } from '../../game/format'
import type { GameState } from '../../game/types'
import { LogList } from './LogList'

interface Props {
  state: GameState
  onSelectShip: (id: string) => void
}

export function FleetPanel({ state, onSelectShip }: Props) {
  const l = state.ledger
  const costs = l.fuel + l.harbour + l.canal + l.running
  return (
    <div>
      <h2>Laivasto</h2>
      <ul className="fleet">
        {state.ships.map((s) => {
          const t = getShipType(s.typeId)
          const where = s.voyage
            ? `Merellä: ${getPort(s.voyage.from).name} → ${getPort(s.voyage.to).name}`
            : `Satamassa: ${getPort(s.portId!).name}`
          return (
            <li key={s.id}>
              <button className="ship-card" onClick={() => onSelectShip(s.id)}>
                <div className="ship-name">{s.name}</div>
                <div className="muted">{t.name}</div>
                <div className={s.voyage ? 'status at-sea' : 'status in-port'}>{where}</div>
                <div className="ship-stats">
                  <span>Polttoaine {fmtNum(s.fuel)}/{fmtNum(t.fuelCapacity)} t</span>
                  <span>Kunto {Math.round(s.condition)} %</span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <h3>Talous</h3>
      <dl className="facts">
        <dt>Rahtitulot</dt>
        <dd className="pos">{fmtMoney(l.revenue)}</dd>
        <dt>Polttoaine</dt>
        <dd>{fmtCost(l.fuel)}</dd>
        <dt>Satamamaksut</dt>
        <dd>{fmtCost(l.harbour)}</dd>
        <dt>Kanavamaksut</dt>
        <dd>{fmtCost(l.canal)}</dd>
        <dt>Miehistö ja vakuutus</dt>
        <dd>{fmtCost(l.running)}</dd>
        <dt className="total">Tulos</dt>
        <dd className={`total ${l.revenue - costs < 0 ? 'neg' : 'pos'}`}>{fmtMoney(l.revenue - costs)}</dd>
      </dl>

      <h3>Tapahtumat</h3>
      <LogList state={state} />
    </div>
  )
}
