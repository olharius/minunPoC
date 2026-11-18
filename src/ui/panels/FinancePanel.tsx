import { creditAvailable, creditLimit, LOAN_RATE, monthlyInterest } from '../../game/bank'
import { fleetValue } from '../../game/fleet'
import { fmtCost, fmtMoney } from '../../game/format'
import type { GameState } from '../../game/types'

interface Props {
  state: GameState
  onBorrow: (amount: number) => void
  onRepay: (amount: number) => void
}

const STEPS = [500_000, 2_000_000, 10_000_000]

export function FinancePanel({ state, onBorrow, onRepay }: Props) {
  const l = state.ledger
  const costs = l.fuel + l.harbour + l.canal + l.running + l.repairs + l.interest + l.incidents + (l.penalties ?? 0)
  const fleet = fleetValue(state)
  const avail = creditAvailable(state)
  const short = (n: number) => (n >= 1e6 ? `${n / 1e6} M` : `${n / 1000} k`)

  return (
    <div>
      <h3>Tase</h3>
      <dl className="facts money">
        <dt>Kassa</dt>
        <dd className={state.money < 0 ? 'neg' : ''}>{fmtMoney(state.money)}</dd>
        <dt>Laivaston arvo</dt>
        <dd>{fmtMoney(fleet)}</dd>
        <dt>Laina</dt>
        <dd>{fmtCost(state.loan)}</dd>
        <dt className="total">Nettovarallisuus</dt>
        <dd className="total">{fmtMoney(state.money + fleet - state.loan)}</dd>
      </dl>

      <h3>Pankki</h3>
      <dl className="facts money">
        <dt>Luottoraja</dt>
        <dd>{fmtMoney(creditLimit(state))}</dd>
        <dt>Lainavaraa jäljellä</dt>
        <dd>{fmtMoney(avail)}</dd>
        <dt>Korko</dt>
        <dd>
          {Math.round(LOAN_RATE * 100)} % / v ({fmtMoney(monthlyInterest(state))} / kk)
        </dd>
      </dl>
      <p className="hint">Luottoraja on 60 % laivaston arvosta + 500 000 $. Jos kassa on kuun lopussa miinuksella, pankki kattaa vajeen lainalla. Jos lainavara ei riitä, varustamo menee konkurssiin.</p>
      <div className="btn-row">
        {STEPS.map((a) => (
          <button key={`b${a}`} className="small" disabled={a > avail} onClick={() => onBorrow(a)}>
            Lainaa {short(a)}
          </button>
        ))}
      </div>
      <div className="btn-row">
        {STEPS.map((a) => (
          <button key={`r${a}`} className="small" disabled={state.loan <= 0 || state.money <= 0} onClick={() => onRepay(a)}>
            Lyhennä {short(a)}
          </button>
        ))}
        <button className="small" disabled={state.loan <= 0 || state.money <= 0} onClick={() => onRepay(state.loan)}>
          Maksa kaikki
        </button>
      </div>

      <h3>Tuloslaskelma (koko peli)</h3>
      <dl className="facts money">
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
        <dt>Korjaukset</dt>
        <dd>{fmtCost(l.repairs)}</dd>
        <dt>Korot</dt>
        <dd>{fmtCost(l.interest)}</dd>
        <dt>Välikohtaukset merellä</dt>
        <dd>{fmtCost(l.incidents)}</dd>
        <dt>Sopimussakot</dt>
        <dd>{fmtCost(l.penalties ?? 0)}</dd>
        <dt className="total">Tulos</dt>
        <dd className={`total ${l.revenue - costs < 0 ? 'neg' : 'pos'}`}>{fmtMoney(l.revenue - costs)}</dd>
      </dl>
    </div>
  )
}
