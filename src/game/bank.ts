import { MONTH } from './calendar'
import { fleetValue } from './fleet'
import { fmtMoney } from './format'
import { addLog as log, clone } from './state'
import type { GameState } from './types'

// The bank: one running loan, interest monthly, credit secured on the fleet.

export const LOAN_RATE = 0.09
/** Credit the bank always offers, on top of 60 % of the fleet's value. */
const BASE_CREDIT = 500_000

export function creditLimit(state: GameState): number {
  return Math.round((fleetValue(state) * 0.6 + BASE_CREDIT) / 10000) * 10000
}

export function creditAvailable(state: GameState): number {
  return Math.max(0, creditLimit(state) - state.loan)
}

export function monthlyInterest(state: GameState): number {
  return Math.round((state.loan * LOAN_RATE) / 12)
}

export function borrow(state: GameState, amount: number): GameState {
  const a = Math.round(amount)
  if (a <= 0) return state
  if (a > creditAvailable(state)) throw new Error(`Pankki lainaa enintään ${fmtMoney(creditAvailable(state))}.`)
  const s = clone(state)
  s.loan += a
  s.money += a
  log(s, { kind: 'bank', text: 'Otettiin lainaa.', amount: a })
  return s
}

export function repay(state: GameState, amount: number): GameState {
  const a = Math.round(Math.min(amount, state.loan, state.money))
  if (a <= 0) return state
  const s = clone(state)
  s.loan -= a
  s.money -= a
  log(s, { kind: 'bank', text: 'Lyhennettiin lainaa.', amount: -a })
  return s
}

/**
 * Month end: pay interest, then cover an overdraft with credit if the bank
 * allows. With no credit left the company goes bankrupt. Mutates `s`.
 */
export function monthEnd(s: GameState) {
  if (s.day % MONTH !== 0) return
  const interest = monthlyInterest(s)
  if (interest > 0) {
    s.money -= interest
    s.ledger.interest += interest
    log(s, { kind: 'bank', text: `Lainan korko (${Math.round(LOAN_RATE * 100)} % vuodessa).`, amount: -interest })
  }
  if (s.money < 0) {
    const need = Math.ceil(-s.money / 10000) * 10000
    if (need <= creditAvailable(s)) {
      s.loan += need
      s.money += need
      log(s, { kind: 'warning', text: 'Kassa oli miinuksella. Pankki kattoi vajeen lisälainalla.', amount: need })
    } else {
      s.bankrupt = true
      log(s, { kind: 'warning', text: 'Pankki kieltäytyi lisälainasta. Varustamo meni konkurssiin.' })
    }
  }
}
