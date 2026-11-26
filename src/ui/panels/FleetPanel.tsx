import { getPort } from '../../data/ports'
import { getShipType } from '../../data/shipTypes'
import { fmtDay, fmtNum } from '../../game/format'
import { getCargo } from '../../game/market'
import type { GameState, OwnedShip } from '../../game/types'
import { activeHold, holdText } from '../../game/voyage'

interface Props {
  state: GameState
  onSelectShip: (id: string) => void
}

function statusOf(state: GameState, s: OwnedShip): { text: string; cls: string } {
  const dateOf = (day: number) => fmtDay(state, day)
  if (s.voyage) {
    const cargo = s.voyage.contract ? `${fmtNum(s.voyage.contract.tonnes)} t ${getCargo(s.voyage.contract.cargoId).name.toLowerCase()}` : 'ei lastia'
    const hold = activeHold(s.voyage, state.day)
    if (hold) return { text: `${holdText(hold, state.day)} · → ${getPort(s.voyage.to).name}, perillä ${dateOf(Math.ceil(s.voyage.arriveDay))}`, cls: 'at-sea held' }
    return { text: `→ ${getPort(s.voyage.to).name}, perillä ${dateOf(Math.ceil(s.voyage.arriveDay))} · ${cargo}`, cls: 'at-sea' }
  }
  if (s.dockUntil !== null) return { text: `Telakalla: ${getPort(s.portId!).name}, valmis ${dateOf(s.dockUntil)}`, cls: 'docked' }
  if (s.orders) return { text: `Etsii rahtia: ${getPort(s.portId!).name}`, cls: 'in-port' }
  return { text: `Odottaa satamassa: ${getPort(s.portId!).name}`, cls: 'in-port idle' }
}

export function FleetPanel({ state, onSelectShip }: Props) {
  const idle = state.ships.filter((s) => !s.voyage && s.dockUntil === null && !s.orders).length
  const auto = state.ships.filter((s) => s.orders).length
  return (
    <div>
      <p className="hint">
        {state.ships.length} laivaa · {state.ships.length - idle} töissä · {idle} odottaa käskyjä{auto > 0 && ` · ${auto} automaatilla`}
      </p>
      <ul className="fleet">
        {state.ships.map((s) => {
          const t = getShipType(s.typeId)
          const st = statusOf(state, s)
          return (
            <li key={s.id}>
              <button className="ship-card" onClick={() => onSelectShip(s.id)}>
                <div className="offer-top">
                  <span className="ship-name">
                    {s.orders && <span className="badge auto">Auto</span>}
                    {s.name}
                  </span>
                  <span className={`cond ${s.condition < 50 ? 'neg' : ''}`}>{Math.round(s.condition)} %</span>
                </div>
                <div className="muted">
                  {t.name} · {fmtNum(t.capacity)} t{s.captain && ` · kapteeni ${s.captain.name} (taso ${s.captain.level})`}
                </div>
                <div className={`status ${st.cls}`}>{st.text}</div>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="hint">Lisää laivoja voit ostaa minkä tahansa keskikokoisen tai suuren sataman Laivakauppa-välilehdeltä.</p>
    </div>
  )
}
