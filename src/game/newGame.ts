import { getShipType } from '../data/shipTypes'
import type { GameState } from './types'

export const STARTING_MONEY = 2_000_000
export const STARTING_SHIP_TYPE = 'coaster'

export function newGame(companyName: string, homePortId: string, shipName: string): GameState {
  const type = getShipType(STARTING_SHIP_TYPE)
  return {
    companyName: companyName.trim() || 'Nimetön Varustamo',
    homePortId,
    day: 0,
    startDate: '1990-01-01',
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
      },
    ],
    nextId: 2,
    seed: Math.floor(Math.random() * 2 ** 31),
    takenOffers: [],
    log: [{ day: 0, kind: 'info', text: `${companyName.trim() || 'Nimetön Varustamo'} perustettiin. Etsi ensimmäinen rahti kotisatamasta!` }],
    ledger: { revenue: 0, fuel: 0, harbour: 0, canal: 0, running: 0 },
  }
}

export function currentDate(state: GameState): Date {
  const d = new Date(state.startDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + state.day)
  return d
}
