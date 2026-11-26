import { captainCandidates, captainWage, hiringFee, traitInfo } from '../../game/captains'
import { fmtMoney } from '../../game/format'
import type { GameState, OwnedShip } from '../../game/types'

interface Props {
  state: GameState
  portId: string
  ship: OwnedShip | null
  onHire: (shipId: string, captainId: string) => void
}

/** Captains looking for work at this port this month. */
export function CaptainsTab({ state, portId, ship, onHire }: Props) {
  const list = captainCandidates(state, portId)
  if (!list.length) return <p className="hint">Tässä satamassa ei ole kapteeneja tarjolla. Kapteeneja löytää keskikokoisista ja suurista satamista.</p>
  return (
    <>
      <p className="hint">Kapteeni kerryttää kokemusta merellä ja nousee tasolta toiselle (enintään 5). Uusia hakijoita tulee kuukausittain.</p>
      <ul className="offers">
        {list.map((c) => (
          <li key={c.id} className="offer">
            <div className="offer-top">
              <span className="offer-cargo">{c.name}</span>
              <span className="offer-pay">{fmtMoney(hiringFee(c))}</span>
            </div>
            <div className="offer-mid">
              <strong>{traitInfo(c.trait).name}</strong>, taso {c.level}: {traitInfo(c.trait).perLevel}
            </div>
            <div className="offer-mid">Palkka {fmtMoney(captainWage(c))} / päivä</div>
            <div className="offer-actions">
              {ship ? (
                <button className="primary small" disabled={hiringFee(c) > state.money} onClick={() => onHire(ship.id, c.id)}>
                  {ship.captain ? `Vaihda laivan ${ship.name} kapteeniksi` : `Palkkaa laivalle ${ship.name}`}
                </button>
              ) : (
                <span className="why">Tuo laiva tähän satamaan palkataksesi</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
