import { useRef, useState } from 'react'
import { getPort } from '../data/ports'
import { getRoute } from '../data/routes'
import { fmtDate, fmtMoney } from '../game/format'
import { currentDate } from '../game/newGame'
import { downloadSave, readSaveFile } from '../game/save'
import { acceptOffer, advanceDay, arrivals, depart, refuel } from '../game/sim'
import type { Contract, GameState } from '../game/types'
import { borrow, repay } from '../game/bank'
import { buyNewShip, buyUsedShip, sellShip, shipValue, startRepair, usedListings } from '../game/fleet'
import { getShipType } from '../data/shipTypes'
import { BuyDialog } from './BuyDialog'
import { FinancePanel } from './panels/FinancePanel'
import { FleetPanel } from './panels/FleetPanel'
import { LogList } from './panels/LogList'
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
type Purchase = { portId: string; typeId: string; price: number; condition: number; listingId?: string; name?: string } | null
type RootTab = 'fleet' | 'finance' | 'log'

export function GameScreen({ state, onChange, onQuit }: Props) {
  const [selection, setSelection] = useState<Selection>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [purchase, setPurchase] = useState<Purchase>(null)
  const [rootTab, setRootTab] = useState<RootTab>('fleet')
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
  const clock = useClock(running && !pending && !purchase && !state.bankrupt, speed, step)
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
          {state.loan > 0 && <span title="Laina">🏦 {fmtMoney(-state.loan)}</span>}
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
              onRepair={(shipId) => act(() => startRepair(state, shipId))}
              onSell={(shipId) => {
                const ship = state.ships.find((x) => x.id === shipId)!
                if (window.confirm(`Myydäänkö ${ship.name} hintaan ${fmtMoney(shipValue(ship))}?`)) act(() => sellShip(state, shipId))
              }}
              onBuyNew={(portId, typeId) => setPurchase({ portId, typeId, price: getShipType(typeId).price, condition: 100 })}
              onBuyUsed={(listingId) => {
                const l = usedListings(state, selection.id).find((x) => x.id === listingId)
                if (l) setPurchase({ portId: l.portId, typeId: l.typeId, price: l.price, condition: l.condition, listingId: l.id, name: l.name })
              }}
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
            <>
              <div className="tabs" role="tablist">
                {(
                  [
                    ['fleet', 'Laivasto'],
                    ['finance', 'Talous'],
                    ['log', 'Tapahtumat'],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={rootTab === id} className={rootTab === id ? 'active' : ''} onClick={() => setRootTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
              {rootTab === 'fleet' && (
                <FleetPanel
                  state={state}
                  onSelectShip={(id) => {
                    const s = state.ships.find((x) => x.id === id)
                    setSelection(s?.portId ? { kind: 'port', id: s.portId } : { kind: 'ship', id })
                  }}
                />
              )}
              {rootTab === 'finance' && <FinancePanel state={state} onBorrow={(a) => act(() => borrow(state, a))} onRepay={(a) => act(() => repay(state, a))} />}
              {rootTab === 'log' && <LogList state={state} limit={80} />}
            </>
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

      {purchase && (
        <BuyDialog
          state={state}
          portId={purchase.portId}
          typeId={purchase.typeId}
          price={purchase.price}
          condition={purchase.condition}
          suggestedName={purchase.name}
          onCancel={() => setPurchase(null)}
          onConfirm={(name, loan) => {
            const p = purchase
            setPurchase(null)
            act(() => {
              const funded = loan > 0 ? borrow(state, loan) : state
              return p.listingId ? buyUsedShip(funded, p.listingId, name) : buyNewShip(funded, p.portId, p.typeId, name)
            })
            flash(`${name} liittyi laivastoon!`)
          }}
        />
      )}

      {state.bankrupt && (
        <div className="modal-back">
          <div className="modal" role="alertdialog" aria-modal="true">
            <h2>Konkurssi</h2>
            <p>
              Pankki ei enää myöntänyt lisää luottoa, ja {state.companyName} asetettiin konkurssiin {fmtDate(currentDate(state))}.
            </p>
            <dl className="facts money">
              <dt>Toimintapäiviä</dt>
              <dd>{state.day}</dd>
              <dt>Laivoja</dt>
              <dd>{state.ships.length}</dd>
              <dt>Rahtitulot yhteensä</dt>
              <dd>{fmtMoney(state.ledger.revenue)}</dd>
            </dl>
            <p className="hint">Voit ladata aiemman tallennustiedoston tai aloittaa uuden pelin päävalikosta.</p>
            <div className="row end">
              <button onClick={() => fileRef.current?.click()}>Lataa tallennus…</button>
              <button className="primary" onClick={onQuit}>
                Päävalikkoon
              </button>
            </div>
          </div>
        </div>
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
