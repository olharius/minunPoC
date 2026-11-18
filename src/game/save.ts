import type { GameState } from './types'

// Save format. Bump SAVE_VERSION and add a step to `migrate` whenever
// GameState changes shape, so old saves keep loading.
export const SAVE_VERSION = 1
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
  return { game: 'minunpoc', version: SAVE_VERSION, savedAt: String(data.savedAt ?? ''), state: migrated }
}

function migrate(_version: number, state: Record<string, unknown>): GameState {
  // No older versions yet. Future: if (version < 2) { ...upgrade... }
  return state as unknown as GameState
}

function validate(s: GameState) {
  const ok =
    typeof s.companyName === 'string' &&
    typeof s.homePortId === 'string' &&
    typeof s.day === 'number' &&
    typeof s.money === 'number' &&
    Array.isArray(s.ships)
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
