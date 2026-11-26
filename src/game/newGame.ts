import { getShipType } from '../data/shipTypes'
import { START_DATE } from './calendar'
import type { GameState } from './types'
import { snapshot } from './yearReview'

export const STARTING_MONEY = 2_000_000
export const STARTING_SHIP_TYPE = 'coaster'

export function newGame(companyName: string, homePortId: string, shipName: string): GameState {
  const type = getShipType(STARTING_SHIP_TYPE)
  const s: GameState = {
    companyName: companyName.trim() || 'Nimetön Varustamo',
    homePortId,
    day: 0,
    startDate: START_DATE,
    money: STARTING_MONEY,
    ships: [
      {
        id: 's1',
        name: shipName.trim() || 'Ensimmäinen',
        typeId: type.id,
        portId: homePortId,
        fuel: type.fuelCapacity,
        condition: 100,
        voyage: null,
        dockUntil: null,
        acquiredDay: 0,
      },
    ],
    nextId: 2,
    seed: Math.floor(Math.random() * 2 ** 31),
    takenOffers: [],
    log: [{ day: 0, kind: 'info', text: `${companyName.trim() || 'Nimetön Varustamo'} perustettiin. Etsi ensimmäinen rahti kotisatamasta!` }],
    ledger: { revenue: 0, fuel: 0, harbour: 0, canal: 0, running: 0, repairs: 0, interest: 0, incidents: 0, penalties: 0, awards: 0 },
    loan: 0,
    takenListings: [],
    bankrupt: false,
    pendingEvent: null,
    settings: { manualDocking: false, autoEvents: false },
    stats: newStats([homePortId]),
    milestones: [],
    yearStart: null!,
    yearReports: [],
  }
  s.yearStart = snapshot(s, 1990)
  return s
}

export function newStats(portsVisited: string[]): GameState['stats'] {
  return { deliveries: 0, onTime: 0, onTimeStreak: 0, expressOnTime: 0, tonnes: 0, portsVisited, canalsUsed: [], rescues: 0 }
}

/** Calendar date of the current game day. */
export function currentDate(state: Pick<GameState, 'startDate' | 'day'>): Date {
  const d = new Date(state.startDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + state.day)
  return d
}

/** Calendar date of any game day. */
export function dateOfDay(state: Pick<GameState, 'startDate'>, day: number): Date {
  return currentDate({ startDate: state.startDate, day })
}
