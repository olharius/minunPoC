import { getCanal } from '../data/canals'
import { getPort } from '../data/ports'
import { useState } from 'react'
import { getShipType } from '../data/shipTypes'
import { latePenalty, PACES, penaltyPerDay, planVoyage, voyageFuelValue, type Pace } from '../game/economy'
import { fmtCost, fmtDay, fmtMoney, fmtNum } from '../game/format'
import { getCargo } from '../game/market'
import type { Contract, GameState } from '../game/types'

interface Props {
  state: GameState
  shipId: string
  to: string
  contract: Contract | null
  onConfirm: (pace: Pace) => void
  onCancel: () => void
}

export function VoyageDialog({ state, shipId, to, contract, onConfirm, onCancel }: Props) {
  const ship = state.ships.find((s) => s.id === shipId)!
  const capacity = getShipType(ship.typeId).fuelCapacity
  const options = PACES.map((p) => ({ pace: p, ...estimate(state, shipId, to, contract, p.id) }))
  const [pace, setPace] = useState<Pace>('normal')
  const { plan, burned, arrivalDay, late, revenue, penalty, profit } = options.find((o) => o.pace.id === pace)!
  const dateOf = (day: number) => fmtDay(state, day)
  const cashNeeded = plan.fuelCost + plan.canalTolls

  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>
          {getPort(plan.from).name} → {getPort(to).name}
        </h2>
        <p className="muted">
          {contract?.express && <span className="badge express">Express</span>}
          {ship.name} · {contract ? `${fmtNum(contract.tonnes)} t ${getCargo(contract.cargoId).name.toLowerCase()}` : 'ilman lastia'}
        </p>
        <div className="pace-picker" role="radiogroup" aria-label="Nopeus">
          {options.map((o) => {
            const tooFar = o.plan.fuelNeeded > capacity
            return (
              <button
                key={o.pace.id}
                role="radio"
                aria-checked={pace === o.pace.id}
                className={pace === o.pace.id ? 'active' : ''}
                disabled={tooFar}
                title={o.pace.detail}
                onClick={() => setPace(o.pace.id)}
              >
                <strong>{o.pace.label}</strong>
                <span>{tooFar ? 'polttoaine ei riitä' : `${o.plan.arriveInDays} pv`}</span>
                {!tooFar && <span className={o.late > 0 ? 'neg' : o.profit < 0 ? 'neg' : 'pos'}>{fmtMoney(o.profit)}</span>}
              </button>
            )
          })}
        </div>
        <p className="hint">{PACES.find((p) => p.id === pace)!.detail}</p>
        <dl className="facts">
          <dt>Matka</dt>
          <dd>{fmtNum(plan.nm)} meripeninkulmaa</dd>
          <dt>Kesto</dt>
          <dd>
            {plan.arriveInDays} päivää, perillä {dateOf(arrivalDay)}
          </dd>
          {plan.canals.length > 0 && (
            <>
              <dt>Reitti</dt>
              <dd>{plan.canals.map((c) => getCanal(c)?.name ?? c).join(', ')}</dd>
            </>
          )}
          {contract && (
            <>
              <dt>Määräaika</dt>
              <dd className={late > 0 ? 'neg' : ''}>
                {dateOf(contract.deadlineDay)}
                {late > 0 ? ` (myöhässä ${late} pv)` : ` (pelivaraa ${-late} pv)`}
              </dd>
              <dt>Sopimussakko</dt>
              <dd>{fmtMoney(penaltyPerDay(contract))} / myöhästetty päivä</dd>
            </>
          )}
        </dl>

        <h3>Arvio</h3>
        <dl className="facts money">
          {contract && (
            <>
              <dt>Rahtimaksu</dt>
              <dd className="pos">{fmtMoney(revenue)}</dd>
            </>
          )}
          <dt>Polttoaine (kulutus)</dt>
          <dd>{fmtCost(burned)}</dd>
          <dt>Miehistö ja vakuutus</dt>
          <dd>{fmtCost(plan.runningCost)}</dd>
          <dt>Satamamaksu ({getPort(to).name})</dt>
          <dd>{fmtCost(plan.harbourFee)}</dd>
          {plan.canalTolls > 0 && (
            <>
              <dt>Kanavamaksut</dt>
              <dd>{fmtCost(plan.canalTolls)}</dd>
            </>
          )}
          {contract && late > 0 && (
            <>
              <dt>Sopimussakko ({late} pv)</dt>
              <dd className="neg">{fmtCost(penalty)}</dd>
            </>
          )}
          <dt className="total">Tulos</dt>
          <dd className={`total ${profit < 0 ? 'neg' : 'pos'}`}>{fmtMoney(profit)}</dd>
        </dl>
        {contract && late <= 0 && late >= -3 && <p className="hint">Aikataulu on tiukka: myrsky tai konevika voi myöhästyttää toimitusta, ja jokainen myöhästetty päivä maksaa {fmtMoney(penaltyPerDay(contract))}.</p>}
        {plan.fuelToBuy > 0 && (
          <p className="hint">
            Laivaan tankataan ennen lähtöä {fmtNum(plan.fuelToBuy)} t polttoainetta ({fmtMoney(plan.fuelCost)}).
          </p>
        )}
        {cashNeeded > state.money && <p className="error">Kassa ei riitä polttoaineeseen ja kanavamaksuihin, mutta voit silti lähteä velaksi.</p>}
        <div className="row end">
          <button onClick={onCancel}>Peruuta</button>
          <button className="primary" onClick={() => onConfirm(pace)} autoFocus>
            Lähde matkaan
          </button>
        </div>
      </div>
    </div>
  )
}

/** Days, costs and result of the voyage at one pace. */
function estimate(state: GameState, shipId: string, to: string, contract: Contract | null, pace: Pace) {
  const plan = planVoyage(state, shipId, to, pace)
  const burned = voyageFuelValue(state, shipId, to, pace)
  const arrivalDay = state.day + plan.arriveInDays
  const late = contract ? arrivalDay - contract.deadlineDay : 0
  const revenue = contract ? contract.pay : 0
  const penalty = contract ? latePenalty(contract, late) : 0
  const profit = revenue - (burned + plan.runningCost + plan.harbourFee + plan.canalTolls + penalty)
  return { plan, burned, arrivalDay, late, revenue, penalty, profit }
}
