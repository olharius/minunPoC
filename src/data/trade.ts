// What each port typically ships out and takes in, loosely after the real
// world: oil from oil countries, grain from grain countries and so on.
// The numbers are weights. In `exports` they make a cargo more common on the
// port's freight board; in `imports` they make the port a more likely
// destination for that cargo. Ordinary general cargo moves everywhere.

export interface TradeProfile {
  exports: Record<string, number>
  imports: Record<string, number>
}

export const TRADE: Record<string, TradeProfile> = {
  helsinki: { exports: { paper: 4, timber: 4, machinery: 2, steel: 1.5 }, imports: { 'crude-oil': 2, coal: 1.5, cars: 2, containers: 1.5 } },
  rotterdam: { exports: { diesel: 3, chemicals: 3, containers: 2, machinery: 1.5 }, imports: { 'crude-oil': 4, 'iron-ore': 3, coal: 3, soybeans: 2, grain: 1.5 } },
  hamburg: { exports: { machinery: 3, cars: 3, chemicals: 2, containers: 2 }, imports: { 'iron-ore': 2, coal: 2, soybeans: 1.5, 'crude-oil': 1.5 } },
  london: { exports: { machinery: 1.5, chemicals: 1.5, cars: 1.5 }, imports: { grain: 1.5, timber: 2, diesel: 1.5, containers: 1.5, cars: 1.5 } },
  marseille: { exports: { chemicals: 2, diesel: 2, grain: 2 }, imports: { 'crude-oil': 3, containers: 1.5 } },
  genoa: { exports: { machinery: 2.5, steel: 1.5, cars: 1.5 }, imports: { 'crude-oil': 2, 'iron-ore': 2, coal: 2 } },
  piraeus: { exports: { containers: 2, diesel: 1.5 }, imports: { grain: 2, 'crude-oil': 2, containers: 1.5 } },
  alexandria: { exports: { chemicals: 1.5, 'crude-oil': 1.5 }, imports: { grain: 4, machinery: 2, steel: 1.5, timber: 1.5 } },
  lagos: { exports: { 'crude-oil': 5 }, imports: { diesel: 4, cars: 3, machinery: 2, grain: 2, containers: 1.5 } },
  capetown: { exports: { coal: 3, 'iron-ore': 3, steel: 1.5 }, imports: { diesel: 2, machinery: 2, cars: 1.5 } },
  mombasa: { exports: {}, imports: { diesel: 3, grain: 2, machinery: 2, steel: 1.5, cars: 2 } },
  dubai: { exports: { 'crude-oil': 5, diesel: 3, chemicals: 2, containers: 2 }, imports: { machinery: 3, cars: 3, grain: 2, steel: 2, timber: 1.5 } },
  mumbai: { exports: { diesel: 2.5, chemicals: 2, steel: 1.5 }, imports: { 'crude-oil': 4, coal: 3, machinery: 2 } },
  colombo: { exports: { containers: 2 }, imports: { diesel: 2, grain: 1.5 } },
  singapore: { exports: { diesel: 3, chemicals: 3, containers: 3 }, imports: { 'crude-oil': 4, containers: 1.5 } },
  hongkong: { exports: { containers: 3 }, imports: { diesel: 1.5, grain: 1.5 } },
  shanghai: { exports: { containers: 4, steel: 3, machinery: 3, cars: 1.5 }, imports: { 'iron-ore': 5, soybeans: 4, coal: 3, 'crude-oil': 3, timber: 2, grain: 2 } },
  yokohama: { exports: { cars: 4, machinery: 4, steel: 2, chemicals: 1.5 }, imports: { 'iron-ore': 3, coal: 3, 'crude-oil': 3, grain: 2, soybeans: 1.5 } },
  sydney: { exports: { coal: 4, 'iron-ore': 3, grain: 3 }, imports: { cars: 3, machinery: 2, diesel: 2, containers: 1.5 } },
  losangeles: { exports: { containers: 2, chemicals: 1.5 }, imports: { containers: 3, cars: 2, machinery: 2, steel: 1.5 } },
  vancouver: { exports: { grain: 4, coal: 3, timber: 4 }, imports: { containers: 2, cars: 2, machinery: 1.5 } },
  newyork: { exports: { chemicals: 1.5, machinery: 1.5 }, imports: { containers: 2, cars: 2, diesel: 1.5 } },
  houston: { exports: { chemicals: 5, 'crude-oil': 4, diesel: 4, grain: 2 }, imports: { machinery: 2, steel: 2 } },
  panama: { exports: {}, imports: { diesel: 2 } },
  santos: { exports: { soybeans: 5, 'iron-ore': 3, grain: 2 }, imports: { diesel: 2, chemicals: 2, machinery: 2 } },
  buenosaires: { exports: { grain: 5, soybeans: 4 }, imports: { machinery: 2, diesel: 2, cars: 1.5 } },
  valparaiso: { exports: { timber: 2, paper: 2, 'iron-ore': 1.5 }, imports: { diesel: 2, machinery: 2, cars: 2 } },
  antwerp: { exports: { chemicals: 4, cars: 2, steel: 2, containers: 2 }, imports: { 'crude-oil': 3, 'iron-ore': 2, coal: 1.5, timber: 1.5 } },
  gothenburg: { exports: { cars: 3, paper: 3, steel: 2, machinery: 2 }, imports: { 'crude-oil': 2, containers: 1.5, chemicals: 1.5 } },
  stpetersburg: { exports: { 'crude-oil': 3, timber: 3, steel: 2, coal: 2 }, imports: { cars: 3, machinery: 3, containers: 2 } },
  gdansk: { exports: { coal: 3, grain: 2, steel: 1.5 }, imports: { 'crude-oil': 3, 'iron-ore': 2, containers: 1.5 } },
  barcelona: { exports: { cars: 3, chemicals: 2, containers: 1.5 }, imports: { soybeans: 2, grain: 2, 'crude-oil': 2 } },
  istanbul: { exports: { steel: 3, cars: 2, containers: 1.5 }, imports: { 'iron-ore': 3, coal: 2, grain: 2, 'crude-oil': 2 } },
  durban: { exports: { coal: 3, steel: 2, grain: 1.5 }, imports: { diesel: 2, cars: 2, machinery: 2, containers: 1.5 } },
  abidjan: { exports: { timber: 2, 'crude-oil': 1.5 }, imports: { diesel: 3, grain: 2, cars: 2, machinery: 2 } },
  tangiers: { exports: { cars: 3, containers: 2 }, imports: { machinery: 2, steel: 1.5 } },
  jeddah: { exports: { 'crude-oil': 3, chemicals: 2, diesel: 2 }, imports: { grain: 3, cars: 3, machinery: 2, steel: 2 } },
  salalah: { exports: { containers: 2 }, imports: { containers: 2, diesel: 1.5 } },
  karachi: { exports: { grain: 2, chemicals: 1.5 }, imports: { 'crude-oil': 3, diesel: 2, machinery: 2, steel: 1.5 } },
  chennai: { exports: { cars: 3, machinery: 1.5 }, imports: { coal: 3, 'crude-oil': 2, steel: 1.5 } },
  jakarta: { exports: { coal: 4, timber: 2, chemicals: 1.5 }, imports: { machinery: 2, grain: 2, steel: 2, diesel: 2 } },
  manila: { exports: { containers: 1.5 }, imports: { grain: 3, diesel: 2, cars: 2, machinery: 1.5 } },
  shenzhen: { exports: { containers: 5, machinery: 2 }, imports: { 'crude-oil': 2, soybeans: 2, chemicals: 1.5 } },
  busan: { exports: { containers: 3, steel: 3, cars: 3, machinery: 2 }, imports: { 'iron-ore': 4, coal: 3, 'crude-oil': 3 } },
  melbourne: { exports: { grain: 3, containers: 1.5 }, imports: { cars: 3, machinery: 2, containers: 1.5 } },
  auckland: { exports: { timber: 3, paper: 1.5 }, imports: { cars: 3, diesel: 2, machinery: 1.5 } },
  savannah: { exports: { paper: 2, timber: 2, chemicals: 1.5 }, imports: { containers: 2.5, cars: 2, machinery: 1.5 } },
  veracruz: { exports: { cars: 2, steel: 1.5, 'crude-oil': 1.5 }, imports: { grain: 3, machinery: 2, chemicals: 1.5 } },
  callao: { exports: { 'iron-ore': 2, grain: 1 }, imports: { diesel: 2, machinery: 2, cars: 2 } },
}

const EMPTY: TradeProfile = { exports: {}, imports: {} }

export function tradeOf(portId: string): TradeProfile {
  return TRADE[portId] ?? EMPTY
}

/** The port's main exports, biggest first (for the port panel). */
export function mainExports(portId: string, limit = 3): string[] {
  return Object.entries(tradeOf(portId).exports)
    .filter(([, w]) => w >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
}

/** The port's main imports, biggest first. */
export function mainImports(portId: string, limit = 3): string[] {
  return Object.entries(tradeOf(portId).imports)
    .filter(([, w]) => w >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
}
