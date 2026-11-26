import { PORTS } from '../data/ports'
import { getShipType } from '../data/shipTypes'
import { netWorth } from './fleet'
import { fmtMoney } from './format'
import { addLog as log } from './state'
import type { GameState } from './types'

// Milestones: goals the company works towards, each with a prize. They are
// checked once a day; reached ones are stored with the day they were reached.

export interface Milestone {
  id: string
  title: string
  text: string
  reward: number
  /** [where the company is now, the target]. Reached when now >= target. */
  progress: (s: GameState) => [number, number]
}

const REGIONS = [...new Set(PORTS.map((p) => p.region))]
const regionOf = new Map(PORTS.map((p) => [p.id, p.region]))
const M = 1_000_000

const shipCount = (n: number) => (s: GameState): [number, number] => [s.ships.length, n]
const deliveries = (n: number) => (s: GameState): [number, number] => [s.stats.deliveries, n]
const worth = (n: number) => (s: GameState): [number, number] => [Math.max(0, netWorth(s)), n]

export const MILESTONES: Milestone[] = [
  { id: 'first-delivery', title: 'Ensimmäinen rahti', text: 'Toimita ensimmäinen rahti perille.', reward: 50_000, progress: deliveries(1) },
  { id: 'fleet-2', title: 'Laivasto kasvaa', text: 'Omista kaksi laivaa.', reward: 100_000, progress: shipCount(2) },
  { id: 'ports-10', title: 'Maailmanmatkaaja', text: 'Käy kymmenessä eri satamassa.', reward: 200_000, progress: (s) => [s.stats.portsVisited.length, 10] },
  { id: 'deliveries-25', title: 'Luotettava kuljettaja', text: 'Toimita 25 rahtia.', reward: 250_000, progress: deliveries(25) },
  { id: 'worth-10m', title: 'Kymmenen miljoonaa', text: 'Kasvata yhtiön arvo 10 miljoonaan dollariin.', reward: 250_000, progress: worth(10 * M) },
  { id: 'streak-10', title: 'Täsmällisyyden maine', text: 'Toimita 10 rahtia peräkkäin ajallaan.', reward: 300_000, progress: (s) => [s.stats.onTimeStreak, 10] },
  { id: 'debt-free', title: 'Velaton varustamo', text: 'Omista vähintään kolme laivaa ilman pankkilainaa.', reward: 300_000, progress: (s) => [s.loan > 0 ? 0 : Math.min(s.ships.length, 3), 3] },
  { id: 'hero', title: 'Meren sankari', text: 'Pelasta merihädässä olevia kolme kertaa.', reward: 300_000, progress: (s) => [s.stats.rescues, 3] },
  { id: 'fleet-5', title: 'Oikea varustamo', text: 'Omista viisi laivaa.', reward: 500_000, progress: shipCount(5) },
  { id: 'express-10', title: 'Pikalähetti', text: 'Toimita 10 Express-rahtia ajallaan.', reward: 500_000, progress: (s) => [s.stats.expressOnTime, 10] },
  { id: 'canals', title: 'Kanavien kautta', text: 'Kulje sekä Suezin että Panaman kanavan kautta.', reward: 400_000, progress: (s) => [['suez', 'panama'].filter((c) => s.stats.canalsUsed.includes(c)).length, 2] },
  {
    id: 'all-classes',
    title: 'Joka lastille laiva',
    text: 'Omista yleisrahti-, kontti-, irtolasti- ja säiliöalus.',
    reward: 1 * M,
    progress: (s) => [new Set(s.ships.map((x) => getShipType(x.typeId).cargoClass)).size, 4],
  },
  {
    id: 'seven-seas',
    title: 'Kaikilla merillä',
    text: `Käy satamassa jokaisella alueella (${REGIONS.length} aluetta).`,
    reward: 1 * M,
    progress: (s) => [new Set(s.stats.portsVisited.map((p) => regionOf.get(p))).size, REGIONS.length],
  },
  { id: 'deliveries-100', title: 'Rahtien ammattilainen', text: 'Toimita 100 rahtia.', reward: 1 * M, progress: deliveries(100) },
  { id: 'worth-50m', title: 'Merten mahti', text: 'Kasvata yhtiön arvo 50 miljoonaan dollariin.', reward: 1 * M, progress: worth(50 * M) },
  { id: 'all-ports', title: 'Jokaisessa satamassa', text: `Käy kaikissa ${PORTS.length} satamassa.`, reward: 2 * M, progress: (s) => [s.stats.portsVisited.length, PORTS.length] },
  { id: 'fleet-15', title: 'Suurvarustamo', text: 'Omista 15 laivaa.', reward: 3 * M, progress: shipCount(15) },
  { id: 'deliveries-500', title: 'Logistiikkajätti', text: 'Toimita 500 rahtia.', reward: 5 * M, progress: deliveries(500) },
  { id: 'worth-250m', title: 'Merten Keisari', text: 'Kasvata yhtiön arvo 250 miljoonaan dollariin.', reward: 5 * M, progress: worth(250 * M) },
]

const byId = new Map(MILESTONES.map((m) => [m.id, m]))

export function getMilestone(id: string): Milestone | undefined {
  return byId.get(id)
}

export function isReached(s: GameState, m: Milestone): boolean {
  const [now, target] = m.progress(s)
  return now >= target
}

/** Award every milestone reached since the last check. Mutates `s`; returns the new ones. */
export function checkMilestones(s: GameState): Milestone[] {
  const done = new Set(s.milestones.map((m) => m.id))
  const fresh = MILESTONES.filter((m) => !done.has(m.id) && isReached(s, m))
  for (const m of fresh) {
    s.milestones = [...s.milestones, { id: m.id, day: s.day }]
    s.money += m.reward
    s.ledger.awards += m.reward
    log(s, { kind: 'award', text: `Virstanpylväs saavutettu: ${m.title}. Palkinto ${fmtMoney(m.reward)}.`, amount: m.reward })
  }
  return fresh
}
