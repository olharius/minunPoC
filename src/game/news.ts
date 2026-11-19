import { CARGO_TYPES } from '../data/cargoTypes'
import { PORTS } from '../data/ports'
import { monthOf } from './calendar'
import { hashString, rng } from './rng'
import type { GameState } from './types'

// World news: each month brings one or two headlines that move the freight
// market. They are derived from the save's seed, so nothing extra is stored.

export type News =
  | { kind: 'boom'; cargoId: string; factor: number; text: string }
  | { kind: 'slump'; cargoId: string; factor: number; text: string }
  | { kind: 'strike'; portId: string; text: string }

const BOOM_TEXT: Record<string, string> = {
  grain: 'Kato Aasiassa: viljan kuljetushinnat nousevat.',
  'iron-ore': 'Teräksen kysyntä kasvaa: rautamalmille on kova kysyntä.',
  coal: 'Kylmä talvi lisää kivihiilen kysyntää.',
  containers: 'Kulutushyödykkeiden vienti kasvaa: konttirahdit kallistuvat.',
  diesel: 'Polttoaineen kysyntä kasvaa: dieselin rahtihinnat nousevat.',
  chemicals: 'Kemianteollisuus laajenee: kemikaalirahdit nousevat.',
  machinery: 'Teollisuuden investoinnit kasvavat: konerahdit kallistuvat.',
  timber: 'Rakennusbuumi lisää sahatavaran kysyntää.',
  paper: 'Painotalojen kysyntä kasvaa: paperirahdit nousevat.',
  'crude-oil': 'Jalostamot lisäävät tuotantoa: raakaöljyn rahtihinnat nousevat.',
  soybeans: 'Rehun kysyntä kasvaa: soijapapujen rahtihinnat nousevat.',
  steel: 'Infrastruktuurihankkeet lisäävät teräksen kysyntää.',
  cars: 'Automyynti vilkastuu: autorahdit kallistuvat.',
  'general-goods': 'Kauppa vilkastuu: kappaletavaran rahdit nousevat.',
}

// The headlines are asked for many times a day (every freight offer and
// harbour fee checks them), so each month's list is worked out only once.
const newsCache = new Map<string, readonly News[]>()
const NEWS_CACHE_SIZE = 24

export function monthNews(state: Pick<GameState, 'seed'>, month: number): readonly News[] {
  // Calm first month, so a new player meets a normal market.
  if (month <= 0) return []
  const key = `${state.seed}:${month}`
  let news = newsCache.get(key)
  if (!news) {
    news = rollNews(state.seed, month)
    if (newsCache.size >= NEWS_CACHE_SIZE) newsCache.delete(newsCache.keys().next().value!)
    newsCache.set(key, news)
  }
  return news
}

function rollNews(seed: number, month: number): readonly News[] {
  const r = rng(hashString(`${seed}:news:${month}`))
  const out: News[] = []
  const count = r.next() < 0.5 ? 1 : 2
  const used = new Set<string>()
  for (let i = 0; i < count; i++) {
    const roll = r.next()
    if (roll < 0.45) {
      const c = r.pick(CARGO_TYPES.filter((c) => !used.has(c.id)))
      used.add(c.id)
      out.push({ kind: 'boom', cargoId: c.id, factor: 1.35, text: BOOM_TEXT[c.id] ?? `${c.name}: kysyntä kasvaa.` })
    } else if (roll < 0.8) {
      const c = r.pick(CARGO_TYPES.filter((c) => !used.has(c.id)))
      used.add(c.id)
      out.push({ kind: 'slump', cargoId: c.id, factor: 0.7, text: `Ylitarjontaa markkinoilla: ${c.name.toLowerCase()}rahtien hinnat laskevat.` })
    } else {
      const p = r.pick(PORTS)
      out.push({ kind: 'strike', portId: p.id, text: `Satamatyöläiset lakossa: ${p.name}. Ei uusia rahteja, ja satamamaksut ovat kaksinkertaiset.` })
    }
  }
  return Object.freeze(out.map((n) => Object.freeze(n)))
}

export function currentNews(state: Pick<GameState, 'seed' | 'day'>): readonly News[] {
  return monthNews(state, monthOf(state.day))
}

/** Multiplier for freight pay of a cargo this month. */
export function cargoFactor(state: Pick<GameState, 'seed' | 'day'>, cargoId: string): number {
  return currentNews(state).reduce((f, n) => (n.kind !== 'strike' && n.cargoId === cargoId ? f * n.factor : f), 1)
}

export function portOnStrike(state: Pick<GameState, 'seed' | 'day'>, portId: string): boolean {
  return currentNews(state).some((n) => n.kind === 'strike' && n.portId === portId)
}
