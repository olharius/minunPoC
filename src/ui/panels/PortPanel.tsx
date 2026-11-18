import { useState } from 'react'
import { PORTS, getPort } from '../../data/ports'
import { getRoute } from '../../data/routes'
import { getShipType } from '../../data/shipTypes'
import { fuelPrice, harbourFee, inRange } from '../../game/economy'
import { canRepairAt, repairQuote, sellsNewShips, shipValue, usedListings } from '../../game/fleet'
import { fmtDate, fmtMoney, fmtNum } from '../../game/format'
import { getCargo, nextMarketDay, offerFits, portOffers } from '../../game/market'
import { currentDate } from '../../game/newGame'
import type { Contract, GameState } from '../../game/types'
import { portOnStrike } from '../../game/news'
import { ShipyardTab } from './ShipyardTab'

export interface PortActions {
  onChooseOffer: (shipId: string, offer: Contract) => void
  onChooseEmpty: (shipId: string, to: string) => void
  onRefuel: (shipId: string) => void
  onRepair: (shipId: string) => void
  onSell: (shipId: string) => void
  onBuyNew: (portId: string, typeId: string) => void
  onBuyUsed: (listingId: string) => void
  onPreview: (to: string | null) => void
}

interface Props extends PortActions {
  state: GameState
  portId: string
  onClose: () => void
}

type Tab = 'freight' | 'yard'

export function PortPanel(props: Props) {
  const { state, portId, onClose } = props
  const p = getPort(portId)
  const here = state.ships.filter((s) => s.portId === portId)
  const [tab, setTab] = useState<Tab>('freight')
  const [pickedShip, setPickedShip] = useState<string | null>(null)
  const ship = here.find((s) => s.id === pickedShip) ?? here[0] ?? null
  const t = ship ? getShipType(ship.typeId) : null
  const sizeLabel = ['', 'Pieni satama', 'Keskikokoinen satama', 'Suursatama'][p.size]
  const price = fuelPrice(state, portId)
  const hasYard = sellsNewShips(portId) || usedListings(state, portId).length > 0

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
            <dd>{fmtMoney(harbourFee(p.id, t, state))}</dd>
          </>
        )}
        <dt>Palvelut</dt>
        <dd>{[sellsNewShips(portId) && 'uudet laivat', hasYard && 'käytetyt laivat', canRepairAt(portId) && 'korjaustelakka'].filter(Boolean).join(', ') || '–'}</dd>
      </dl>

      {portOnStrike(state, portId) && <div className="news">📰 Satamatyöläiset ovat lakossa tämän kuun: ei uusia rahteja, ja satamamaksut ovat kaksinkertaiset.</div>}

      {here.length > 0 && ship && t && (
        <div className="ship-in-port">
          {here.length > 1 ? (
            <label>
              Laiva
              <select value={ship.id} onChange={(e) => setPickedShip(e.target.value)}>
                {here.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({getShipType(s.typeId).name})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div>
              <span className="ship-name">{ship.name}</span> <span className="muted">· {t.name}</span>
            </div>
          )}
          <div className="ship-stats">
            <span>Lastitila {fmtNum(t.capacity)} t</span>
            <span>
              Polttoaine {fmtNum(ship.fuel)}/{fmtNum(t.fuelCapacity)} t
            </span>
            <span className={ship.condition < 50 ? 'neg' : ''}>Kunto {Math.round(ship.condition)} %</span>
            <span>Arvo {fmtMoney(shipValue(ship))}</span>
          </div>
          {ship.dockUntil !== null ? (
            <div className="status docked">Telakalla, valmis {fmtDate(currentDate({ ...state, day: ship.dockUntil }))}</div>
          ) : (
            <div className="btn-row">
              <button className="small" disabled={ship.fuel >= t.fuelCapacity} onClick={() => props.onRefuel(ship.id)}>
                Tankkaa ({fmtMoney(Math.round((t.fuelCapacity - ship.fuel) * price))})
              </button>
              {canRepairAt(portId) && ship.condition < 100 && (
                <button className="small" onClick={() => props.onRepair(ship.id)}>
                  Korjaa ({repairQuote(ship).days} pv, {fmtMoney(repairQuote(ship).cost)})
                </button>
              )}
              <button className="small" disabled={state.ships.length < 2} onClick={() => props.onSell(ship.id)} title={state.ships.length < 2 ? 'Viimeistä laivaa ei voi myydä' : ''}>
                Myy ({fmtMoney(shipValue(ship))})
              </button>
            </div>
          )}
        </div>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'freight'} className={tab === 'freight' ? 'active' : ''} onClick={() => setTab('freight')}>
          Rahtimarkkina
        </button>
        <button role="tab" aria-selected={tab === 'yard'} className={tab === 'yard' ? 'active' : ''} onClick={() => setTab('yard')}>
          Laivakauppa
        </button>
      </div>

      {tab === 'freight' ? (
        <FreightTab {...props} ship={ship} />
      ) : (
        <ShipyardTab state={state} portId={portId} onBuyNew={props.onBuyNew} onBuyUsed={props.onBuyUsed} />
      )}
    </div>
  )
}

function FreightTab({ state, portId, ship, onChooseOffer, onChooseEmpty, onPreview }: Props & { ship: GameState['ships'][number] | null }) {
  const t = ship ? getShipType(ship.typeId) : null
  const [emptyTo, setEmptyTo] = useState('')
  const dateOf = (day: number) => fmtDate(currentDate({ ...state, day }))
  // Offers this ship can take first, then the rest; each group by pay.
  const offers = portOffers(state, portId)
    .map((o) => ({ o, why: ship && t ? offerFits(ship, t, o) : 'Ei laivaa' }))
    .sort((a, b) => Number(!!a.why) - Number(!!b.why))

  return (
    <>
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
                  {why ? (
                    <span className="why">{why}</span>
                  ) : (
                    <button className="primary small" onClick={() => onChooseOffer(ship.id, o)}>
                      Ota rahti…
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {ship && t && ship.dockUntil === null && (
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
                  const nm = getRoute(portId, x.id).nm
                  const ok = inRange(t, nm, ship.condition)
                  return (
                    <option key={x.id} value={x.id} disabled={!ok}>
                      {x.name} ({fmtNum(nm)} mpk){ok ? '' : ' – liian kaukana'}
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
    </>
  )
}
