import { useState } from 'react'
import { PORTS } from '../data/ports'
import { PACES, type Pace } from '../game/economy'
import { AUTO_REPAIR_BELOW, BROKER_FEE } from '../game/orders'
import type { GameState, ShipOrders } from '../game/types'

const REGIONS = [...new Set(PORTS.map((p) => p.region))]

interface Props {
  state: GameState
  shipId: string
  onSave: (orders: ShipOrders | null) => void
  onCancel: () => void
}

/** Standing orders for one ship: area, pace and auto-repair. */
export function OrdersDialog({ state, shipId, onSave, onCancel }: Props) {
  const ship = state.ships.find((s) => s.id === shipId)!
  const current = ship.orders
  const [regions, setRegions] = useState<string[]>(current?.regions ?? [])
  const [pace, setPace] = useState<Pace>(current?.pace ?? 'normal')
  const [autoRepair, setAutoRepair] = useState(current?.autoRepair ?? true)
  const toggle = (r: string) => setRegions((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))

  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Automaattiohjaus: {ship.name}</h2>
        <p className="hint">
          Laiva valitsee itse rahdin, joka tuottaa eniten päivää kohden ja ehtii perille ajoissa. Jos sopivaa rahtia ei ole viikkoon, laiva siirtyy
          tyhjänä vilkkaampaan satamaan. Rahtimeklari ottaa jokaisesta rahdista {Math.round(BROKER_FEE * 100)} % palkkion. Voit ottaa ohjauksen
          takaisin milloin tahansa.
        </p>

        <h3>Toiminta-alue</h3>
        <div className="region-grid">
          <label className="check">
            <input type="checkbox" checked={regions.length === 0} onChange={() => setRegions([])} /> Koko maailma
          </label>
          {REGIONS.map((r) => (
            <label key={r} className="check">
              <input type="checkbox" checked={regions.includes(r)} onChange={() => toggle(r)} /> {r}
            </label>
          ))}
        </div>

        <h3>Nopeus</h3>
        <div className="pace-picker" role="radiogroup" aria-label="Nopeus">
          {PACES.map((p) => (
            <button key={p.id} role="radio" aria-checked={pace === p.id} className={pace === p.id ? 'active' : ''} title={p.detail} onClick={() => setPace(p.id)}>
              <strong>{p.label}</strong>
            </button>
          ))}
        </div>

        <label className="check">
          <input type="checkbox" checked={autoRepair} onChange={(e) => setAutoRepair(e.target.checked)} /> Telakoi itse, kun kunto laskee alle {AUTO_REPAIR_BELOW} %
        </label>

        <div className="row end">
          {current && <button onClick={() => onSave(null)}>Lopeta automaatti</button>}
          <button onClick={onCancel}>Peruuta</button>
          <button className="primary" onClick={() => onSave({ regions, pace, autoRepair })} autoFocus>
            {current ? 'Tallenna' : 'Käynnistä'}
          </button>
        </div>
      </div>
    </div>
  )
}
