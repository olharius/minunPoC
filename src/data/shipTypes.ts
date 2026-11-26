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
  /** Year the type first comes on the market; missing = from the start. */
  availableFrom?: number
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
    id: 'mpp',
    name: 'Monitoimirahtilaiva',
    description: 'Omilla nostureilla varustettu yleisrahtilaiva. Kantaa myös kontteja.',
    cargoClass: 'general',
    capacity: 14000,
    speed: 15,
    fuelPerDay: 22,
    fuelCapacity: 1400,
    dailyCost: 5500,
    price: 12_000_000,
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
    dailyCost: 6500,
    price: 14_000_000,
  },
  {
    id: 'panamax-bulk',
    name: 'Panamax-irtolastialus',
    description: 'Suurin Panaman kanavaan mahtuva irtolastialus. Edullinen tonnia kohden.',
    cargoClass: 'bulk',
    capacity: 65000,
    speed: 14,
    fuelPerDay: 34,
    fuelCapacity: 2600,
    dailyCost: 10500,
    price: 32_000_000,
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
    price: 22_000_000,
  },
  {
    id: 'panamax-container',
    name: 'Panamax-konttialus',
    description: 'Suuri ja nopea konttialus valtamerireiteille.',
    cargoClass: 'container',
    capacity: 40000,
    speed: 21,
    fuelPerDay: 70,
    fuelCapacity: 4500,
    dailyCost: 15000,
    price: 55_000_000,
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
    dailyCost: 8500,
    price: 26_000_000,
  },
  {
    id: 'aframax',
    name: 'Aframax-säiliöalus',
    description: 'Suuri säiliöalus pitkille öljykuljetuksille.',
    cargoClass: 'liquid',
    capacity: 95000,
    speed: 14.5,
    fuelPerDay: 46,
    fuelCapacity: 3500,
    dailyCost: 13500,
    price: 48_000_000,
  },
  {
    id: 'post-panamax-container',
    name: 'Post-Panamax-konttialus',
    description: 'Liian leveä Panaman kanavaan, mutta valtava ja nopea. Kantaa uudet jättikonttierät.',
    cargoClass: 'container',
    capacity: 60000,
    speed: 24,
    fuelPerDay: 110,
    fuelCapacity: 7000,
    dailyCost: 21000,
    price: 85_000_000,
    availableFrom: 1996,
  },
  {
    id: 'supramax',
    name: 'Supramax-irtolastialus',
    description: 'Omilla nostureilla varustettu moderni irtolastialus. Lähes Panamaxin kokoinen, mutta selvästi säästeliäämpi.',
    cargoClass: 'bulk',
    capacity: 55000,
    speed: 14.5,
    fuelPerDay: 27,
    fuelCapacity: 2400,
    dailyCost: 8500,
    price: 28_000_000,
    availableFrom: 2001,
  },
  {
    id: 'eco-coaster',
    name: 'Ekorannikkorahtilaiva',
    description: 'Uuden sukupolven pieni yleisrahtilaiva: vähän isompi ja nopeampi kuin vanha rannikkorahtilaiva, mutta kuluttaa vähemmän.',
    cargoClass: 'general',
    capacity: 8000,
    speed: 13,
    fuelPerDay: 10,
    fuelCapacity: 600,
    dailyCost: 3600,
    price: 7_000_000,
    availableFrom: 2004,
  },
]

const byId = new Map(SHIP_TYPES.map((t) => [t.id, t]))

export function getShipType(id: string): ShipType {
  const t = byId.get(id)
  if (!t) throw new Error(`Tuntematon laivatyyppi: ${id}`)
  return t
}
