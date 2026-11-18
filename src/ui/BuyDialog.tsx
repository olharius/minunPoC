import { useState } from 'react'
import { getPort } from '../data/ports'
import { getShipType } from '../data/shipTypes'
import { creditAvailable } from '../game/bank'
import { fmtMoney, fmtNum } from '../game/format'
import { fleetNameKeys, isNameTaken, suggestName } from '../game/names'
import type { GameState } from '../game/types'

const NAME_IDEAS = ['Aallotar', 'Merituuli', 'Pohjantähti', 'Ahti', 'Vellamo', 'Kotka', 'Ulappa', 'Myrskylintu', 'Revontuli', 'Saaristo', 'Laine', 'Tursas']

interface Props {
  state: GameState
  portId: string
  typeId: string
  price: number
  condition: number
  suggestedName?: string
  onConfirm: (name: string, borrow: number) => void
  onCancel: () => void
}

export function BuyDialog({ state, portId, typeId, price, condition, suggestedName, onConfirm, onCancel }: Props) {
  const t = getShipType(typeId)
  const [name, setName] = useState(() => suggestName(suggestedName ? [suggestedName] : NAME_IDEAS, fleetNameKeys(state)))
  const nameTaken = isNameTaken(state, name)
  const shortfall = Math.max(0, price - state.money)
  const borrow = shortfall > 0 ? Math.ceil(shortfall / 10000) * 10000 : 0
  const canAfford = borrow <= creditAvailable(state)

  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{condition < 100 ? 'Osta käytetty laiva' : 'Tilaa uusi laiva'}</h2>
        <p className="muted">
          {t.name} · {getPort(portId).name}
        </p>
        <dl className="facts">
          <dt>Lastitila</dt>
          <dd>{fmtNum(t.capacity)} t</dd>
          <dt>Nopeus</dt>
          <dd>{t.speed} solmua</dd>
          <dt>Kulutus</dt>
          <dd>{t.fuelPerDay} t/päivä</dd>
          <dt>Päiväkulut</dt>
          <dd>{fmtMoney(t.dailyCost)}</dd>
          <dt>Kunto</dt>
          <dd>{condition} %</dd>
          <dt className="total">Hinta</dt>
          <dd className="total">{fmtMoney(price)}</dd>
        </dl>
        <label style={{ marginTop: 14 }}>
          Laivan nimi
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus />
        </label>
        {nameTaken && <p className="error">Laivastossa on jo tämänniminen laiva. Valitse toinen nimi.</p>}
        {borrow > 0 &&
          (canAfford ? (
            <p className="hint">Kassa ei riitä, joten pankista otetaan {fmtMoney(borrow)} lainaa (korko 9 % vuodessa).</p>
          ) : (
            <p className="error">Kassa ja lainavara eivät riitä tähän kauppaan.</p>
          ))}
        <div className="row end">
          <button onClick={onCancel}>Peruuta</button>
          <button className="primary" disabled={!canAfford || !name.trim() || nameTaken} onClick={() => onConfirm(name, borrow)}>
            {borrow > 0 ? 'Lainaa ja osta' : 'Osta'}
          </button>
        </div>
      </div>
    </div>
  )
}
