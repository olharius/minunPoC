// The whole saveable game state. Everything here must be plain JSON
// (no classes, Dates or Maps) so it can be stored and exported as-is.

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
}
