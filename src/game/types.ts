// The whole saveable game state. Everything here must be plain JSON
// (no classes, Dates or Maps) so it can be stored and exported as-is.

/** A freight job: carry `tonnes` of `cargoId` from `from` to `to`. */
export interface Contract {
  id: string
  cargoId: string
  tonnes: number
  from: string
  to: string
  /** Paid on delivery, dollars. Reduced if late. */
  pay: number
  /** Last day (game day number) for on-time delivery. */
  deadlineDay: number
}

export interface Voyage {
  from: string
  to: string
  departDay: number
  /** May be fractional; the ship docks on the first whole day at or after it. */
  arriveDay: number
  contract: Contract | null
}

export interface OwnedShip {
  id: string
  name: string
  typeId: string
  /** Port id where the ship is, or null while at sea. */
  portId: string | null
  /** Fuel on board, tonnes. */
  fuel: number
  /** 0–100. */
  condition: number
  voyage: Voyage | null
}

export type LogKind = 'arrival' | 'delivery' | 'late' | 'departure' | 'info' | 'warning'

export interface LogEntry {
  day: number
  kind: LogKind
  text: string
  /** Money change tied to the entry, if any. */
  amount?: number
}

/** Running totals, dollars. */
export interface Ledger {
  revenue: number
  fuel: number
  harbour: number
  canal: number
  running: number
}

export interface GameState {
  companyName: string
  homePortId: string
  /** Days since the game started. Day 0 = start date. */
  day: number
  /** ISO date (YYYY-MM-DD) of day 0. */
  startDate: string
  money: number
  ships: OwnedShip[]
  /** Increments whenever a new id is handed out. */
  nextId: number
  /** Seed for markets and prices. */
  seed: number
  /** Offer ids already taken this market week. */
  takenOffers: string[]
  log: LogEntry[]
  ledger: Ledger
}
