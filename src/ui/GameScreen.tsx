import { useRef, useState } from 'react'
import { getPort } from '../data/ports'
import { getShipType } from '../data/shipTypes'
import { fmtDate, fmtMoney, fmtNum } from '../game/format'
import { distanceNm } from '../game/geo'
import { currentDate } from '../game/newGame'
import { downloadSave, readSaveFile } from '../game/save'
import type { GameState } from '../game/types'
import { WorldMap } from './WorldMap'

interface Props {
  state: GameState
  onLoad: (state: GameState) => void
  onQuit: () => void
}

export function GameScreen({ state, onLoad, onQuit }: Props) {
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 3500)
  }

  return (
    <div className="game">
      <header className="topbar">
        <div className="company">{state.companyName}</div>
        <div className="stats">
          <span title="Päivämäärä">📅 {fmtDate(currentDate(state))}</span>
          <span title="Kassa" className={state.money < 0 ? 'neg' : ''}>
            💰 {fmtMoney(state.money)}
          </span>
          <span title="Laivasto">⚓ {state.ships.length}</span>
        </div>
        <div className="menu">
          <button onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
            Valikko
          </button>
          {menuOpen && (
            <div className="menu-pop" onClick={() => setMenuOpen(false)}>
              <button
                onClick={() => {
                  downloadSave(state)
                  flash('Tallennustiedosto ladattu laitteellesi.')
                }}
              >
                Vie tallennus tiedostoon
              </button>
              <button onClick={() => fileRef.current?.click()}>Lataa tallennustiedosto…</button>
              <button onClick={onQuit}>Päävalikkoon</button>
            </div>
          )}
        </div>
      </header>

      <main className="game-main">
        <WorldMap ships={state.ships} homePortId={state.homePortId} selectedPortId={selectedPortId} onSelectPort={setSelectedPortId} />
        <aside className="panel">
          {selectedPortId ? <PortPanel state={state} portId={selectedPortId} onClose={() => setSelectedPortId(null)} /> : <FleetPanel state={state} onSelectPort={setSelectedPortId} />}
        </aside>
      </main>

      <footer className="savebar">Peli tallentuu automaattisesti tähän selaimeen.</footer>
      {notice && <div className="toast">{notice}</div>}

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
            onLoad((await readSaveFile(f)).state)
            setSelectedPortId(null)
            flash('Tallennus ladattu.')
          } catch (err) {
            flash((err as Error).message)
          }
        }}
      />
    </div>
  )
}

function FleetPanel({ state, onSelectPort }: { state: GameState; onSelectPort: (id: string) => void }) {
  return (
    <div>
      <h2>Laivasto</h2>
      <ul className="fleet">
        {state.ships.map((s) => {
          const t = getShipType(s.typeId)
          return (
            <li key={s.id}>
              <div className="ship-name">{s.name}</div>
              <div className="muted">{t.name}</div>
              <div className="ship-stats">
                <span>Lastitila {fmtNum(t.capacity)} t</span>
                <span>Nopeus {t.speed} solmua</span>
                <span>
                  Polttoaine {fmtNum(s.fuel)}/{fmtNum(t.fuelCapacity)} t
                </span>
                <span>Kunto {s.condition} %</span>
              </div>
              {s.portId && (
                <button className="link" onClick={() => onSelectPort(s.portId!)}>
                  Satamassa: {getPort(s.portId).name}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="hint">Valitse satama kartalta nähdäksesi sen tiedot. Rahtimarkkina ja matkat tulevat seuraavassa vaiheessa.</p>
    </div>
  )
}

function PortPanel({ state, portId, onClose }: { state: GameState; portId: string; onClose: () => void }) {
  const p = getPort(portId)
  const here = state.ships.filter((s) => s.portId === portId)
  const sizeLabel = ['', 'Pieni satama', 'Keskikokoinen satama', 'Suursatama'][p.size]
  const ref = state.ships.find((s) => s.portId && s.portId !== portId)
  const refPort = ref?.portId ? getPort(ref.portId) : null

  return (
    <div>
      <div className="panel-head">
        <h2>{p.name}</h2>
        <button className="close" onClick={onClose} aria-label="Sulje">
          ×
        </button>
      </div>
      <div className="muted">
        {p.country} · {p.region}
        {p.id === state.homePortId && ' · Kotisatama'}
      </div>
      <dl className="facts">
        <dt>Koko</dt>
        <dd>{sizeLabel}</dd>
        <dt>Satamamaksu</dt>
        <dd>alk. {fmtMoney(p.harbourFee)}</dd>
        {refPort && ref && (
          <>
            <dt>Etäisyys ({ref.name})</dt>
            <dd>noin {fmtNum(distanceNm(refPort.lat, refPort.lon, p.lat, p.lon))} mpk</dd>
          </>
        )}
      </dl>
      <h3>Laivasi täällä</h3>
      {here.length ? (
        <ul className="plain">
          {here.map((s) => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Ei laivoja.</p>
      )}
      <p className="hint">Rahtitarjoukset avautuvat vaiheessa 2.</p>
    </div>
  )
}
