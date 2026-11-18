// Port catalogue. Add a port by appending an entry: the map, the new-game
// screen and (later) the freight market pick it up automatically.

export type Region =
  | 'Pohjois-Eurooppa'
  | 'Välimeri'
  | 'Afrikka'
  | 'Lähi-itä'
  | 'Etelä-Aasia'
  | 'Itä-Aasia'
  | 'Oseania'
  | 'Pohjois-Amerikka'
  | 'Etelä-Amerikka'

export interface Port {
  id: string
  name: string
  country: string
  region: Region
  /** Degrees, north positive. */
  lat: number
  /** Degrees, east positive. */
  lon: number
  /** 1 = small, 2 = medium, 3 = major hub. Affects fees and cargo volume. */
  size: 1 | 2 | 3
  /** Base harbour fee per call, in dollars, before ship-size scaling. */
  harbourFee: number
}

export const PORTS: Port[] = [
  { id: 'helsinki', name: 'Helsinki', country: 'Suomi', region: 'Pohjois-Eurooppa', lat: 60.16, lon: 24.95, size: 2, harbourFee: 9000 },
  { id: 'rotterdam', name: 'Rotterdam', country: 'Alankomaat', region: 'Pohjois-Eurooppa', lat: 51.95, lon: 4.14, size: 3, harbourFee: 14000 },
  { id: 'hamburg', name: 'Hampuri', country: 'Saksa', region: 'Pohjois-Eurooppa', lat: 53.54, lon: 9.97, size: 3, harbourFee: 13000 },
  { id: 'london', name: 'Lontoo', country: 'Iso-Britannia', region: 'Pohjois-Eurooppa', lat: 51.5, lon: 0.3, size: 2, harbourFee: 12000 },
  { id: 'marseille', name: 'Marseille', country: 'Ranska', region: 'Välimeri', lat: 43.3, lon: 5.36, size: 2, harbourFee: 10000 },
  { id: 'genoa', name: 'Genova', country: 'Italia', region: 'Välimeri', lat: 44.41, lon: 8.93, size: 2, harbourFee: 10000 },
  { id: 'piraeus', name: 'Pireus', country: 'Kreikka', region: 'Välimeri', lat: 37.94, lon: 23.64, size: 2, harbourFee: 9000 },
  { id: 'alexandria', name: 'Aleksandria', country: 'Egypti', region: 'Afrikka', lat: 31.2, lon: 29.92, size: 2, harbourFee: 7000 },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria', region: 'Afrikka', lat: 6.44, lon: 3.39, size: 2, harbourFee: 8000 },
  { id: 'capetown', name: 'Kapkaupunki', country: 'Etelä-Afrikka', region: 'Afrikka', lat: -33.91, lon: 18.43, size: 2, harbourFee: 8500 },
  { id: 'mombasa', name: 'Mombasa', country: 'Kenia', region: 'Afrikka', lat: -4.06, lon: 39.67, size: 1, harbourFee: 6000 },
  { id: 'dubai', name: 'Dubai', country: 'Arabiemiirikunnat', region: 'Lähi-itä', lat: 25.01, lon: 55.06, size: 3, harbourFee: 12000 },
  { id: 'mumbai', name: 'Mumbai', country: 'Intia', region: 'Etelä-Aasia', lat: 18.95, lon: 72.84, size: 2, harbourFee: 8000 },
  { id: 'colombo', name: 'Colombo', country: 'Sri Lanka', region: 'Etelä-Aasia', lat: 6.95, lon: 79.84, size: 1, harbourFee: 6500 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', region: 'Itä-Aasia', lat: 1.26, lon: 103.84, size: 3, harbourFee: 15000 },
  { id: 'hongkong', name: 'Hongkong', country: 'Kiina', region: 'Itä-Aasia', lat: 22.29, lon: 114.16, size: 3, harbourFee: 14000 },
  { id: 'shanghai', name: 'Shanghai', country: 'Kiina', region: 'Itä-Aasia', lat: 31.23, lon: 121.49, size: 3, harbourFee: 14000 },
  { id: 'yokohama', name: 'Jokohama', country: 'Japani', region: 'Itä-Aasia', lat: 35.44, lon: 139.64, size: 3, harbourFee: 15000 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', region: 'Oseania', lat: -33.86, lon: 151.21, size: 2, harbourFee: 12000 },
  { id: 'losangeles', name: 'Los Angeles', country: 'Yhdysvallat', region: 'Pohjois-Amerikka', lat: 33.74, lon: -118.27, size: 3, harbourFee: 16000 },
  { id: 'vancouver', name: 'Vancouver', country: 'Kanada', region: 'Pohjois-Amerikka', lat: 49.29, lon: -123.11, size: 2, harbourFee: 12000 },
  { id: 'newyork', name: 'New York', country: 'Yhdysvallat', region: 'Pohjois-Amerikka', lat: 40.67, lon: -74.04, size: 3, harbourFee: 16000 },
  { id: 'houston', name: 'Houston', country: 'Yhdysvallat', region: 'Pohjois-Amerikka', lat: 29.73, lon: -95.27, size: 2, harbourFee: 13000 },
  { id: 'panama', name: 'Balboa', country: 'Panama', region: 'Pohjois-Amerikka', lat: 8.95, lon: -79.57, size: 1, harbourFee: 7000 },
  { id: 'santos', name: 'Santos', country: 'Brasilia', region: 'Etelä-Amerikka', lat: -23.96, lon: -46.3, size: 2, harbourFee: 9000 },
  { id: 'buenosaires', name: 'Buenos Aires', country: 'Argentiina', region: 'Etelä-Amerikka', lat: -34.6, lon: -58.37, size: 2, harbourFee: 9000 },
  { id: 'valparaiso', name: 'Valparaíso', country: 'Chile', region: 'Etelä-Amerikka', lat: -33.03, lon: -71.63, size: 1, harbourFee: 7000 },
]

const byId = new Map(PORTS.map((p) => [p.id, p]))

export function getPort(id: string): Port {
  const p = byId.get(id)
  if (!p) throw new Error(`Tuntematon satama: ${id}`)
  return p
}
