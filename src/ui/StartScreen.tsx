import { useRef, useState } from 'react'
import { PORTS } from '../data/ports'
import { fmtMoney } from '../game/format'
import { newGame, STARTING_MONEY } from '../game/newGame'
import { readSaveFile, type SaveFile } from '../game/save'
import type { GameState } from '../game/types'
import { GAME_TITLE } from './title'

interface Props {
  autosave: SaveFile | null
  onStart: (state: GameState) => void
}

export function StartScreen({ autosave, onStart }: Props) {
  const [mode, setMode] = useState<'menu' | 'new'>(autosave ? 'menu' : 'new')
  const [company, setCompany] = useState('')
  const [shipName, setShipName] = useState('')
  const [home, setHome] = useState('helsinki')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const sortedPorts = PORTS.filter((p) => !p.openFrom).sort((a, b) => a.name.localeCompare(b.name, 'fi'))

  return (
    <div className="start">
      <div className="start-card">
        <h1>{GAME_TITLE}</h1>
        <p className="tagline">Rakenna varustamo yhdestä rannikkorahtilaivasta maailmanlaajuiseksi laivastoksi.</p>

        {mode === 'menu' && autosave && (
          <div className="stack">
            <button className="primary" onClick={() => onStart(autosave.state)}>
              Jatka: {autosave.state.companyName}
              <small>
                päivä {autosave.state.day} · {fmtMoney(autosave.state.money)}
              </small>
            </button>
            <button onClick={() => setMode('new')}>Uusi peli</button>
            <button onClick={() => fileRef.current?.click()}>Lataa tallennustiedosto…</button>
          </div>
        )}

        {mode === 'new' && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              onStart(newGame(company, home, shipName))
            }}
          >
            <label>
              Varustamon nimi
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="esim. Pohjolan Linjat Oy" maxLength={40} autoFocus />
            </label>
            <label>
              Ensimmäisen laivasi nimi
              <input value={shipName} onChange={(e) => setShipName(e.target.value)} placeholder="esim. Aallotar" maxLength={30} />
            </label>
            <label>
              Kotisatama
              <select value={home} onChange={(e) => setHome(e.target.value)}>
                {sortedPorts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.country})
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">
              Aloitat {fmtMoney(STARTING_MONEY)} pääomalla ja yhdellä rannikkorahtilaivalla.
              {autosave && ' Uusi peli korvaa selaimeen tallennetun pelin, joten vie se ensin tiedostoon, jos haluat säilyttää sen.'}
            </p>
            <button className="primary" type="submit">
              Aloita peli
            </button>
            <div className="row">
              {autosave && (
                <button type="button" onClick={() => setMode('menu')}>
                  Takaisin
                </button>
              )}
              <button type="button" onClick={() => fileRef.current?.click()}>
                Lataa tallennustiedosto…
              </button>
            </div>
          </form>
        )}

        {error && <p className="error">{error}</p>}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              onStart((await readSaveFile(f)).state)
            } catch (err) {
              setError((err as Error).message)
            }
          }}
        />
      </div>
    </div>
  )
}
