import type { CargoClass } from './shipTypes'

// Cargo catalogue. The freight market (step 2) draws offers from this list.

export interface CargoType {
  id: string
  name: string
  cargoClass: CargoClass
  /** Base freight rate, dollars per tonne per 1000 nautical miles. */
  ratePer1000nm: number
}

export const CARGO_TYPES: CargoType[] = [
  { id: 'grain', name: 'Vilja', cargoClass: 'bulk', ratePer1000nm: 4 },
  { id: 'iron-ore', name: 'Rautamalmi', cargoClass: 'bulk', ratePer1000nm: 3 },
  { id: 'coal', name: 'Kivihiili', cargoClass: 'bulk', ratePer1000nm: 3 },
  { id: 'containers', name: 'Kontit', cargoClass: 'container', ratePer1000nm: 9 },
  { id: 'diesel', name: 'Diesel', cargoClass: 'liquid', ratePer1000nm: 3.5 },
  { id: 'chemicals', name: 'Kemikaalit', cargoClass: 'liquid', ratePer1000nm: 5 },
  { id: 'machinery', name: 'Koneet', cargoClass: 'general', ratePer1000nm: 11 },
  { id: 'timber', name: 'Sahatavara', cargoClass: 'general', ratePer1000nm: 6 },
  { id: 'paper', name: 'Paperi', cargoClass: 'general', ratePer1000nm: 7 },
  { id: 'crude-oil', name: 'Raakaöljy', cargoClass: 'liquid', ratePer1000nm: 3 },
  { id: 'soybeans', name: 'Soijapavut', cargoClass: 'bulk', ratePer1000nm: 4 },
  { id: 'steel', name: 'Teräs', cargoClass: 'general', ratePer1000nm: 8 },
  { id: 'cars', name: 'Autot', cargoClass: 'general', ratePer1000nm: 10 },
  { id: 'general-goods', name: 'Kappaletavara', cargoClass: 'general', ratePer1000nm: 8 },
]
