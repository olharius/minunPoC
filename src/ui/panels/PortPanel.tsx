import { useState } from 'react'
import { PORTS, getPort } from '../../data/ports'
import { getRoute } from '../../data/routes'
import { getShipType } from '../../data/shipTypes'
import { fuelPrice, harbourFee, inRange } from '../../game/economy'
import { fmtDate, fmtMoney, fmtNum } from '../../game/format'
import { getCargo, nextMarketDay, offerFits, portOffers } from '../../game/market'
import { currentDate } from '../../game/newGame'
import type { Contract, GameState } from '../../game/types'

interface Props {
  state: GameState
  portId: string
  onClose: () => void
  onChooseOffer: (shipId: string, offer: Contract) => void
  onChooseEmpty: (shipId: string, to: string) => void
  onRefuel: (shipId: string) => void
  onPreview: (to: string | null) => void
}

export function PortPanel({ state, portId, onClose, onChooseOffer, onChooseEmpty, onRefuel, onPreview }: Props) {
  const p = getPort(portId)
  const here = state.ships.filter((s) => s.portId === portId)
  const [pickedShip, setPickedShip] = useState<string | null>(null)
  const ship = here.find((s) => s.id === pickedShip) ?? here[0] ?? null
  const t = ship ? getShipType(ship.typeId) : null
  // Offers this ship can take first, then the rest; each group by pay.
  const offers = portOffers(state, portId)
    .map((o) => ({ o, why: ship && t ? offerFits(ship, t, o) : 'Ei laivaa' }))
    .sort((a, b) => Number(!!a.why) - Number(!!b.why))
  const sizeLabel = ['', 'Pieni satama', 'Keskikokoinen satama', 'Suursatama'][p.size]
  const price = fuelPrice(state, portId)
  const dateOf = (day: number) => fmtDate(currentDate({ ...state, day }))
  const [emptyTo, setEmptyTo] = useState('')

  return (
    <div>
      <div className="panel-head">
        <h2>{p.name}</h2>
        <button className="close" onClick={onClose} aria-label="Sulje">
          ×
        </button>
      </div>
      <div className="muted">
        {p.country} · {sizeLabel}
        {p.id === state.homePortId && ' · Kotisatama'}
      </div>
      <dl className="facts">
        <dt>Polttoaine</dt>
        <dd>{fmtMoney(price)} / t</dd>
        {t && (
          <>
            <dt>Satamamaksu</dt>
            <dd>{fmtMoney(harbourFee(p.id, t))}</dd>
          </>
        )}
      </dl>

      {here.length > 0 && ship && t && (
        <div className="ship-in-port">
          {here.length > 1 ? (
            <label>
              Laiva
              <select value={ship.id} onChange={(e) => setPickedShip(e.target.value)}>
                {here.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="ship-name">{ship.name}</div>
          )}
          <div className="ship-stats">
            <span>Lastitila {fmtNum(t.capacity)} t</span>
            <span>
              Polttoaine {fmtNum(ship.fuel)}/{fmtNum(t.fuelCapacity)} t
            </span>
          </div>
          <button disabled={ship.fuel >= t.fuelCapacity} onClick={() => onRefuel(ship.id)}>
            Tankkaa täyteen ({fmtMoney(Math.round((t.fuelCapacity - ship.fuel) * price))})
          </button>
        </div>
      )}

      <h3>Rahtimarkkina</h3>
      <p className="hint">Uudet tarjoukset {dateOf(nextMarketDay(state.day))}.</p>
      {!ship && <p className="hint">Sinulla ei ole laivaa täällä. Voit silti katsoa, mitä rahteja satamassa on tarjolla.</p>}
      <ul className="offers">
        {offers.map(({ o, why }) => {
          const cargo = getCargo(o.cargoId)
          const nm = getRoute(portId, o.to).nm
          return (
            <li key={o.id} className={why ? 'offer no-fit' : 'offer'} onMouseEnter={() => onPreview(o.to)} onMouseLeave={() => onPreview(null)}>
              <div className="offer-top">
                <span className="offer-cargo">
                  {cargo.name} · {fmtNum(o.tonnes)} t
                </span>
                <span className="offer-pay">{fmtMoney(o.pay)}</span>
              </div>
              <div className="offer-mid">
                → <strong>{getPort(o.to).name}</strong> · {fmtNum(nm)} mpk · perillä viimeistään {dateOf(o.deadlineDay)}
              </div>
              {ship && (
                <div className="offer-actions">
                  {why ? <span className="why">{why}</span> : <button className="primary small" onClick={() => onChooseOffer(ship.id, o)}>Ota rahti…</button>}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {ship && t && (
        <>
          <h3>Lähde ilman lastia</h3>
          <div className="row">
            <select
              value={emptyTo}
              onChange={(e) => {
                setEmptyTo(e.target.value)
                onPreview(e.target.value || null)
              }}
            >
              <option value="">Valitse satama…</option>
              {PORTS.filter((x) => x.id !== portId)
                .sort((a, b) => a.name.localeCompare(b.name, 'fi'))
                .map((x) => {
                  const ok = inRange(t, getRoute(portId, x.id).nm)
                  return (
                    <option key={x.id} value={x.id} disabled={!ok}>
                      {x.name} ({fmtNum(getRoute(portId, x.id).nm)} mpk){ok ? '' : ' – liian kaukana'}
                    </option>
                  )
                })}
            </select>
            <button disabled={!emptyTo} onClick={() => onChooseEmpty(ship.id, emptyTo)}>
              Suunnittele…
            </button>
          </div>
        </>
      )}
    </div>
  )
}
