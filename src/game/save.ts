import { dedupeShipNames } from './names'
import type { GameState } from './types'

// Save format. Bump SAVE_VERSION and add a step to `migrate` whenever
// GameState changes shape, so old saves keep loading.
export const SAVE_VERSION = 5
const STORAGE_KEY = 'minunpoc.autosave'

export interface SaveFile {
  game: 'minunpoc'
  version: number
  savedAt: string
  state: GameState
}

export function toSaveFile(state: GameState): SaveFile {
  return { game: 'minunpoc', version: SAVE_VERSION, savedAt: new Date().toISOString(), state }
}

/** Parses and upgrades a save. Throws an Error with a Finnish message if it is not usable. */
export function parseSave(text: string): SaveFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Tiedosto ei ole kelvollinen tallennus.')
  }
  if (!isRecord(data) || data.game !== 'minunpoc' || typeof data.version !== 'number' || !isRecord(data.state)) {
    throw new Error('Tiedosto ei ole tämän pelin tallennus.')
  }
  if (data.version > SAVE_VERSION) {
    throw new Error('Tallennus on tehty pelin uudemmalla versiolla.')
  }
  const migrated = migrate(data.version, data.state)
  validate(migrated)
  // Older versions allowed two ships with the same name; number the later ones.
  migrated.ships = dedupeShipNames(migrated.ships)
  return { game: 'minunpoc', version: SAVE_VERSION, savedAt: String(data.savedAt ?? ''), state: migrated }
}

function migrate(version: number, state: Record<string, unknown>): GameState {
  const s = { ...state } as Record<string, unknown>
  if (version < 2) {
    // v2: voyages, markets, log and ledger.
    s.ships = (s.ships as Record<string, unknown>[]).map((ship) => ({ ...ship, voyage: null }))
    s.seed = Math.floor(Math.random() * 2 ** 31)
    s.takenOffers = []
    s.log = []
    s.ledger = { revenue: 0, fuel: 0, harbour: 0, canal: 0, running: 0 }
  }
  if (version < 3) {
    // v3: shipyard, repairs and the bank.
    s.ships = (s.ships as Record<string, unknown>[]).map((ship) => ({ ...ship, dockUntil: null, acquiredDay: 0 }))
    s.ledger = { ...(s.ledger as object), repairs: 0, interest: 0 }
    s.loan = 0
    s.takenListings = []
    s.bankrupt = false
  }
  if (version < 4) {
    // v4: events at sea and settings.
    s.ledger = { ...(s.ledger as object), incidents: 0 }
    s.pendingEvent = null
    s.settings = { manualDocking: false, autoEvents: false }
  }
  if (version < 5) {
    // v5: express jobs and contract penalties (old contracts get the normal penalty rate).
    s.ledger = { ...(s.ledger as object), penalties: 0 }
  }
  return s as unknown as GameState
}

function validate(s: GameState) {
  const ok =
    typeof s.companyName === 'string' &&
    typeof s.homePortId === 'string' &&
    typeof s.day === 'number' &&
    typeof s.money === 'number' &&
    typeof s.seed === 'number' &&
    Array.isArray(s.ships) &&
    Array.isArray(s.log)
  if (!ok) throw new Error('Tallennus on vioittunut.')
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// ---- Browser storage (autosave) ----

export function saveToBrowser(state: GameState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSaveFile(state)))
    return true
  } catch {
    return false
  }
}

export function loadFromBrowser(): SaveFile | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    return text ? parseSave(text) : null
  } catch {
    return null
  }
}

export function clearBrowserSave() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

// ---- File export / import (move a game between devices) ----

export function downloadSave(state: GameState) {
  const blob = new Blob([JSON.stringify(toSaveFile(state), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const slug = state.companyName.toLowerCase().replace(/[^a-z0-9åäö]+/g, '-').replace(/^-|-$/g, '') || 'varustamo'
  a.href = url
  a.download = `${slug}-paiva-${state.day}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function readSaveFile(file: File): Promise<SaveFile> {
  return parseSave(await file.text())
}
