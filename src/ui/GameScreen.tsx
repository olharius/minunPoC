import { useRef, useState } from 'react'
import { getPort } from '../data/ports'
import { getRoute } from '../data/routes'
import { fmtDate, fmtMoney } from '../game/format'
import { currentDate } from '../game/newGame'
import { downloadSave, readSaveFile } from '../game/save'
import { acceptOffer, advanceDay, arrivals, depart, refuel } from '../game/sim'
import type { Contract, GameState } from '../game/types'
import { FleetPanel } from './panels/FleetPanel'
import { PortPanel } from './panels/PortPanel'
import { ShipPanel } from './panels/ShipPanel'
import { SPEEDS, useClock } from './useClock'
import { VoyageDialog } from './VoyageDialog'
import { WorldMap } from './WorldMap'

interface Props {
  state: GameState
  onChange: (state: GameState) => void
  onQuit: () => void
}

type Selection = { kind: 'port'; id: string } | { kind: 'ship'; id: string } | null
type Pending = { shipId: string; to: string; contract: Contract | null } | null

export function GameScreen({ state, onChange, onQuit }: Props) {
  const [selection, setSelection] = useState<Selection>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [previewTo, setPreviewTo] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(0)
  const [pauseOnArrival, setPauseOnArrival] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const noticeTimer = useRef(0)

  const flash = (msg: string) => {
    setNotice(msg)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000)
  }

  const step = () => {
    const next = advanceDay(state)
    const docked = arrivals(state, next)
    onChange(next)
    if (docked.length) {
      const names = docked.map((s) => `${s.name} saapui satamaan ${getPort(s.portId!).name}`).join('. ')
      flash(names + '.')
      if (pauseOnArrival) {
        setRunning(false)
        clock.reset()
        if (docked.length === 1) setSelection({ kind: 'port', id: docked[0].portId! })
      }
    }
  }
  const clock = useClock(running && !pending, speed, step)
  const time = state.day + (running ? clock.fraction : 0)

  const act = (fn: () => GameState) => {
    try {
      onChange(fn())
    } catch (e) {
      flash((e as Error).message)
    }
  }

  const selectedShipId = selection?.kind === 'ship' ? selection.id : null
  const selectedPortId = selection?.kind === 'port' ? selection.id : null
  const previewFrom = pending ? state.ships.find((s) => s.id === pending.shipId)?.portId : selectedPortId
  const previewTarget = pending?.to ?? previewTo
  const preview = previewFrom && previewTarget && previewFrom !== previewTarget ? getRoute(previewFrom, previewTarget) : null
  const anyAtSea = state.ships.some((s) => s.voyage)

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
        <div className="time-controls" role="group" aria-label="Aika">
          <button
            className={running ? '' : 'active'}
            onClick={() => {
              setRunning(false)
              clock.reset()
            }}
            aria-label="Tauko"
            title="Tauko"
          >
            ⏸
          </button>
          {SPEEDS.map((sp, i) => (
            <button
              key={sp.label}
              className={running && speed === i ? 'active' : ''}
              onClick={() => {
                setSpeed(i)
                setRunning(true)
              }}
              aria-label={`Nopeus ${i + 1}`}
              title={`Nopeus ${i + 1}`}
            >
              {sp.label}
            </button>
          ))}
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
              <button onClick={() => setPauseOnArrival((p) => !p)}>
                {pauseOnArrival ? '☑' : '☐'} Pysäytä aika, kun laiva saapuu
              </button>
              <button onClick={onQuit}>Päävalikkoon</button>
            </div>
          )}
        </div>
      </header>

      <main className="game-main">
        <WorldMap
          ships={state.ships}
          time={time}
          homePortId={state.homePortId}
          selectedPortId={selectedPortId}
          selectedShipId={selectedShipId}
          preview={preview}
          onSelectPort={(id) => setSelection(id ? { kind: 'port', id } : null)}
          onSelectShip={(id) => setSelection({ kind: 'ship', id })}
        />
        <aside className="panel" key={selection ? `${selection.kind}-${selection.id}` : 'fleet'}>
          {state.day === 0 && !anyAtSea && !selection && (
            <div className="tip">
              <strong>Aloitus:</strong> avaa kotisatamasi kartalta tai laivastolistasta, valitse rahti ja lähetä laiva matkaan. Käynnistä sitten aika
              ▶-painikkeesta.
            </div>
          )}
          {selection?.kind === 'port' ? (
            <PortPanel
              key={selection.id}
              state={state}
              portId={selection.id}
              onClose={() => setSelection(null)}
              onChooseOffer={(shipId, offer) => setPending({ shipId, to: offer.to, contract: offer })}
              onChooseEmpty={(shipId, to) => setPending({ shipId, to, contract: null })}
              onRefuel={(shipId) => act(() => refuel(state, shipId))}
              onPreview={setPreviewTo}
            />
          ) : selection?.kind === 'ship' ? (
            <ShipPanel
              state={state}
              shipId={selection.id}
              time={time}
              onClose={() => setSelection(null)}
              onSelectPort={(id) => setSelection({ kind: 'port', id })}
            />
          ) : (
            <FleetPanel
              state={state}
              onSelectShip={(id) => {
                const s = state.ships.find((x) => x.id === id)
                setSelection(s?.portId ? { kind: 'port', id: s.portId } : { kind: 'ship', id })
              }}
            />
          )}
        </aside>
      </main>

      {pending && (
        <VoyageDialog
          state={state}
          shipId={pending.shipId}
          to={pending.to}
          contract={pending.contract}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const p = pending
            setPending(null)
            setPreviewTo(null)
            act(() => (p.contract ? acceptOffer(state, p.shipId, p.contract.id) : depart(state, p.shipId, p.to)))
            setSelection({ kind: 'ship', id: p.shipId })
            if (!running) flash('Laiva lähti. Käynnistä aika ▶-painikkeesta.')
          }}
        />
      )}

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
            onChange((await readSaveFile(f)).state)
            setSelection(null)
            setRunning(false)
            flash('Tallennus ladattu.')
          } catch (err) {
            flash((err as Error).message)
          }
        }}
      />
    </div>
  )
}
