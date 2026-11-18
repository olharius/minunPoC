// Ship catalogue. Each type is a template; owned ships reference it by id.

export type CargoClass = 'bulk' | 'container' | 'liquid' | 'general'

export interface ShipType {
  id: string
  name: string
  description: string
  cargoClass: CargoClass
  /** Cargo capacity in tonnes (deadweight available for cargo). */
  capacity: number
  /** Service speed in knots. */
  speed: number
  /** Fuel burned per day at service speed, tonnes. */
  fuelPerDay: number
  /** Fuel tank size, tonnes. */
  fuelCapacity: number
  /** Running cost per day (crew, insurance), dollars. */
  dailyCost: number
  /** New-build price, dollars. */
  price: number
}

export const SHIP_TYPES: ShipType[] = [
  {
    id: 'coaster',
    name: 'Rannikkorahtilaiva',
    description: 'Pieni ja edullinen yleisrahtilaiva. Hyvä ensimmäinen alus.',
    cargoClass: 'general',
    capacity: 6000,
    speed: 12,
    fuelPerDay: 14,
    fuelCapacity: 600,
    dailyCost: 3500,
    price: 4_000_000,
  },
  {
    id: 'handysize',
    name: 'Handysize-irtolastialus',
    description: 'Monikäyttöinen irtolastialus viljalle, malmille ja hiilelle.',
    cargoClass: 'bulk',
    capacity: 28000,
    speed: 14,
    fuelPerDay: 24,
    fuelCapacity: 1500,
    dailyCost: 7000,
    price: 18_000_000,
  },
  {
    id: 'feeder',
    name: 'Syöttökonttialus',
    description: 'Nopea konttialus lyhyille ja keskipitkille reiteille.',
    cargoClass: 'container',
    capacity: 18000,
    speed: 18,
    fuelPerDay: 35,
    fuelCapacity: 1800,
    dailyCost: 9000,
    price: 25_000_000,
  },
  {
    id: 'product-tanker',
    name: 'Tuotesäiliöalus',
    description: 'Kuljettaa jalostettuja öljytuotteita ja kemikaaleja.',
    cargoClass: 'liquid',
    capacity: 40000,
    speed: 14,
    fuelPerDay: 30,
    fuelCapacity: 2000,
    dailyCost: 9500,
    price: 32_000_000,
  },
]

const byId = new Map(SHIP_TYPES.map((t) => [t.id, t]))

export function getShipType(id: string): ShipType {
  const t = byId.get(id)
  if (!t) throw new Error(`Tuntematon laivatyyppi: ${id}`)
  return t
}
