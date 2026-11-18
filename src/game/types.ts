// The whole saveable game state. Everything here must be plain JSON
// (no classes, Dates or Maps) so it can be stored and exported as-is.

/** A freight job: carry `tonnes` of `cargoId` from `from` to `to`. */
export interface Contract {
  id: string
  cargoId: string
  tonnes: number
  from: string
  to: string
  /** Paid on delivery, dollars. */
  pay: number
  /** Last day (game day number) for on-time delivery. */
  deadlineDay: number
  /** Express job: tight deadline, better pay, stiffer penalty. */
  express?: boolean
  /** Contract penalty per day late, dollars (older saves: see `penaltyPerDay`). */
  penaltyPerDay?: number
}

export interface Voyage {
  from: string
  to: string
  departDay: number
  /** May be fractional; the ship docks on the first whole day at or after it. */
  arriveDay: number
  contract: Contract | null
  /** Share of the freight pay still earned (cargo damage lowers it). */
  payFactor?: number
  /** Kinds of decision events already met on this voyage (each at most once). */
  events?: string[]
  /**
   * Where the ship was when an event last changed its pace: share of the route
   * `t` sailed on `day`. Missing = the departure (older saves).
   */
  anchor?: { day: number; t: number }
  /** Times the ship stood still at sea (repairs, pirates). */
  holds?: VoyageHold[]
}

/** The ship stays where it is from `from` until `until` (days). */
export interface VoyageHold {
  from: number
  until: number
  reason: 'repair' | 'service' | 'pirates'
}

export interface EventOption {
  id: string
  label: string
  detail: string
}

/** A decision waiting for the player; time stops until it is answered. */
export interface PendingEvent {
  kind: 'storm' | 'engine' | 'pirates'
  shipId: string
  day: number
  title: string
  text: string
  options: EventOption[]
}

export interface Settings {
  /** Steer ships into port yourself (minigame) instead of using a pilot. */
  manualDocking: boolean
  /** Let captains handle events at sea (always the safe option) without asking. */
  autoEvents: boolean
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
  /** In dry dock for repairs until this day (null when not docked). */
  dockUntil: number | null
  /** Day the company got the ship (for the fleet list). */
  acquiredDay: number
}

export type LogKind = 'arrival' | 'delivery' | 'late' | 'departure' | 'info' | 'warning' | 'bank' | 'shipyard' | 'event' | 'news'

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
  repairs: number
  interest: number
  /** Extra costs from events at sea (repairs at sea, guards, ransom). */
  incidents: number
  /** Contract penalties paid for late deliveries. */
  penalties: number
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
  /** Bank loan outstanding, dollars. */
  loan: number
  /** Used-ship listings already bought this month. */
  takenListings: string[]
  /** Set when the bank refuses further credit while the till is empty. */
  bankrupt: boolean
  pendingEvent: PendingEvent | null
  settings: Settings
}
