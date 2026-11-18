import { PORTS } from '../../data/ports'
import { getShipType, SHIP_TYPES, type ShipType } from '../../data/shipTypes'
import { creditAvailable } from '../../game/bank'
import { sellsNewShips, usedListings } from '../../game/fleet'
import { fmtMoney, fmtNum } from '../../game/format'
import type { GameState } from '../../game/types'

const CLASS_LABEL: Record<string, string> = {
  general: 'Yleisrahti ja kontit',
  container: 'Kontit',
  bulk: 'Irtolasti',
  liquid: 'Nestemäinen lasti',
}

interface Props {
  state: GameState
  portId: string
  onBuyNew: (portId: string, typeId: string) => void
  onBuyUsed: (listingId: string) => void
}

export function ShipyardTab({ state, portId, onBuyNew, onBuyUsed }: Props) {
  const used = usedListings(state, portId)
  const newHere = sellsNewShips(portId)
  const buyingPower = state.money + creditAvailable(state)
  const hubs = PORTS.filter((p) => sellsNewShips(p.id))
    .map((p) => p.name)
    .join(', ')

  return (
    <div>
      <p className="hint">
        Käytössäsi on {fmtMoney(state.money)} kassaa ja {fmtMoney(creditAvailable(state))} lainavaraa.
      </p>
      <h3>Käytetyt laivat</h3>
      {used.length === 0 ? (
        <p className="hint">Tässä satamassa ei ole myynnissä käytettyjä laivoja. Ne vaihtuvat kuukausittain keskikokoisissa ja suurissa satamissa.</p>
      ) : (
        <ul className="offers">
          {used.map((l) => {
            const t = getShipType(l.typeId)
            return (
              <li key={l.id} className="offer">
                <div className="offer-top">
                  <span>{l.name}</span>
                  <span className="offer-pay">{fmtMoney(l.price)}</span>
                </div>
                <ShipSpecs t={t} condition={l.condition} />
                <div className="offer-actions">
                  <button className="primary small" disabled={l.price > buyingPower} onClick={() => onBuyUsed(l.id)}>
                    Osta…
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <h3>Uudet laivat</h3>
      {!newHere ? (
        <p className="hint">Uusia laivoja myydään suurissa satamissa: {hubs}.</p>
      ) : (
        <ul className="offers">
          {SHIP_TYPES.map((t) => (
            <li key={t.id} className="offer">
              <div className="offer-top">
                <span>{t.name}</span>
                <span className="offer-pay">{fmtMoney(t.price)}</span>
              </div>
              <ShipSpecs t={t} />
              <div className="offer-mid">{t.description}</div>
              <div className="offer-actions">
                <button className="primary small" disabled={t.price > buyingPower} onClick={() => onBuyNew(portId, t.id)}>
                  Tilaa…
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">Ostettu laiva luovutetaan tähän satamaan, ja sen tankki on kolmanneksen täynnä.</p>
    </div>
  )
}

function ShipSpecs({ t, condition }: { t: ShipType; condition?: number }) {
  return (
    <div className="offer-mid">
      {t.name} · {CLASS_LABEL[t.cargoClass]}
      <br />
      {fmtNum(t.capacity)} t · {t.speed} solmua · {fmtMoney(t.dailyCost)}/pv
      {condition !== undefined && <> · kunto {condition} %</>}
    </div>
  )
}
