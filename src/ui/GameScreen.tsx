import { useRef, useState } from 'react'
import { getPort } from '../data/ports'
import { getRoute } from '../data/routes'
import { fmtDate, fmtMoney } from '../game/format'
import { currentDate } from '../game/newGame'
import { downloadSave, readSaveFile } from '../game/save'
import { acceptOffer, advanceDay, arrivals, depart, newlyIdle, refuel, type IdleNotice } from '../game/sim'
import { offerFits, portOffers } from '../game/market'
import type { Contract, GameState, OwnedShip } from '../game/types'
import { borrow, repay } from '../game/bank'
import { buyNewShip, buyUsedShip, sellShip, shipValue, startRepair, usedListings } from '../game/fleet'
import { getShipType } from '../data/shipTypes'
import { BuyDialog } from './BuyDialog'
import { DockingGame } from './DockingGame'
import { EventDialog } from './EventDialog'
import { resolveEvent } from '../game/events'
import { currentNews } from '../game/news'
import { applyDocking } from '../game/sim'
import { FinancePanel } from './panels/FinancePanel'
import { FleetPanel } from './panels/FleetPanel'
import { LogList } from './panels/LogList'
import { PortPanel } from './panels/PortPanel'
import { ShipPanel } from './panels/ShipPanel'
import { SPEEDS, useClock } from './useClock'
import { VoyageDialog } from './VoyageDialog'
import { MilestoneDialog, YearReviewDialog } from './AwardDialogs'
import { GoalsPanel } from './panels/GoalsPanel'
import { OrdersDialog } from './OrdersDialog'
import { setOrders } from '../game/orders'
import { dismissCaptain, hireCaptain } from '../game/captains'
import { WorldMap } from './WorldMap'

interface Props {
  state: GameState
  onChange: (state: GameState) => void
  onQuit: () => void
}

type Selection = { kind: 'port'; id: string; shipId?: string } | { kind: 'ship'; id: string } | null
type Pending = { shipId: string; to: string; contract: Contract | null } | null
type Purchase = { portId: string; typeId: string; price: number; condition: number; listingId?: string; name?: string } | null
type RootTab = 'fleet' | 'goals' | 'finance' | 'log'

export function GameScreen({ state, onChange, onQuit }: Props) {
  const [selection, setSelection] = useState<Selection>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [purchase, setPurchase] = useState<Purchase>(null)
  const [rootTab, setRootTab] = useState<RootTab>('fleet')
  const [dockQueue, setDockQueue] = useState<string[]>([])
  const [previewTo, setPreviewTo] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(0)
  const [pauseOnIdle, setPauseOnIdle] = useState(true)
  const [idleQueue, setIdleQueue] = useState<IdleNotice[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [awards, setAwards] = useState<string[]>([])
  const [yearShown, setYearShown] = useState<number | null>(null)
  const [ordersFor, setOrdersFor] = useState<string | null>(null)
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
    if (next.pendingEvent && !state.pendingEvent) {
      setRunning(false)
      clock.reset()
      setSelection({ kind: 'ship', id: next.pendingEvent.shipId })
    }
    if (docked.length && next.settings.manualDocking) {
      setDockQueue((q) => [...q, ...docked.map((s) => s.id)])
      setRunning(false)
      clock.reset()
    }
    const reached = next.milestones.filter((m) => !state.milestones.some((o) => o.id === m.id)).map((m) => m.id)
    const closedYear = next.yearReports.length > state.yearReports.length ? next.yearReports[next.yearReports.length - 1].year : null
    if (reached.length || closedYear !== null) {
      if (reached.length) setAwards((a) => [...a, ...reached])
      if (closedYear !== null) setYearShown(closedYear)
      setRunning(false)
      clock.reset()
    }
    const idle = newlyIdle(state, next)
    if (idle.length && pauseOnIdle) {
      setIdleQueue((q) => [...q, ...idle.filter((n) => !q.some((m) => m.shipId === n.shipId && m.reason === n.reason))])
      setRunning(false)
      clock.reset()
    } else if (idle.length) {
      flash(noticeLines(next, idle).map((l) => l.text).join(' '))
    }
  }
  const clock = useClock(
    running && !pending && !purchase && !ordersFor && !state.bankrupt && !state.pendingEvent && dockQueue.length === 0 && idleQueue.length === 0 && awards.length === 0 && yearShown === null,
    speed,
    step,
  )
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
              <button onClick={() => setPauseOnIdle((p) => !p)}>
                {pauseOnIdle ? '☑' : '☐'} Pysäytä aika, kun laiva jää odottamaan tai sen satamaan tulee uusia rahteja
              </button>
              <button onClick={() => onChange({ ...state, settings: { ...state.settings, manualDocking: !state.settings.manualDocking } })}>
                {state.settings.manualDocking ? '☑' : '☐'} Ohjaa laivat satamaan itse (minipeli)
              </button>
              <button onClick={() => onChange({ ...state, settings: { ...state.settings, autoEvents: !state.settings.autoEvents } })}>
                {state.settings.autoEvents ? '☑' : '☐'} Kapteenit päättävät merellä itse (varovaisesti)
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
              key={`${selection.id}-${selection.shipId ?? ''}`}
              state={state}
              portId={selection.id}
              initialShipId={selection.shipId}
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
              onHire={(shipId, captainId) => act(() => hireCaptain(state, shipId, captainId))}
              onOrders={setOrdersFor}
            />
          ) : selection?.kind === 'ship' ? (
            <ShipPanel
              state={state}
              shipId={selection.id}
              time={time}
              onClose={() => setSelection(null)}
              onSelectPort={(id) => setSelection({ kind: 'port', id })}
              onOrders={setOrdersFor}
              onDismissCaptain={(shipId) => {
                const c = state.ships.find((x) => x.id === shipId)?.captain
                if (c && window.confirm(`Erotetaanko kapteeni ${c.name}? Kokemus menetetään.`)) act(() => dismissCaptain(state, shipId))
              }}
            />
          ) : (
            <>
              {currentNews(state).length > 0 && (
                <div className="news" aria-label="Uutiset">
                  {currentNews(state).map((n) => (
                    <div key={n.text}>📰 {n.text}</div>
                  ))}
                </div>
              )}
              <div className="tabs" role="tablist">
                {(
                  [
                    ['fleet', 'Laivasto'],
                    ['goals', 'Tavoitteet'],
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
              {rootTab === 'goals' && <GoalsPanel state={state} />}
              {rootTab === 'finance' && (
                <FinancePanel state={state} onBorrow={(a) => act(() => borrow(state, a))} onRepay={(a) => act(() => repay(state, a))} onShowYear={setYearShown} />
              )}
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
          onConfirm={(pace) => {
            const p = pending
            setPending(null)
            setPreviewTo(null)
            act(() => (p.contract ? acceptOffer(state, p.shipId, p.contract.id, pace) : depart(state, p.shipId, p.to, null, pace)))
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
            flash(`${name.trim()} liittyi laivastoon!`)
          }}
        />
      )}

      {ordersFor && (
        <OrdersDialog
          state={state}
          shipId={ordersFor}
          onCancel={() => setOrdersFor(null)}
          onSave={(o) => {
            const id = ordersFor
            setOrdersFor(null)
            act(() => setOrders(state, id, o))
            setIdleQueue((q) => q.filter((n) => n.shipId !== id))
            flash(o ? (running ? 'Automaattiohjaus käynnissä.' : 'Automaattiohjaus käynnissä. Käynnistä aika ▶-painikkeesta.') : 'Laiva on taas käsiohjauksessa.')
          }}
        />
      )}

      {state.pendingEvent && !state.bankrupt && <EventDialog state={state} onChoose={(id) => act(() => resolveEvent(state, id))} />}

      {dockQueue.length > 0 && !state.pendingEvent && (() => {
        const ship = state.ships.find((s) => s.id === dockQueue[0])
        if (!ship?.portId) {
          setTimeout(() => setDockQueue((q) => q.slice(1)))
          return null
        }
        return (
          <DockingGame
            key={`${ship.id}-${state.day}`}
            portId={ship.portId}
            shipName={ship.name}
            onDone={(r) => {
              act(() => applyDocking(state, ship.id, r))
              setDockQueue((q) => q.slice(1))
            }}
          />
        )
      })()}

      {idleQueue.length > 0 && !state.pendingEvent && dockQueue.length === 0 && awards.length === 0 && yearShown === null && !state.bankrupt && (() => {
        const items = idleQueue.filter((n) => state.ships.some((s) => s.id === n.shipId && s.portId))
        const close = () => setIdleQueue([])
        const show = (portId: string, shipId: string) => {
          setSelection({ kind: 'port', id: portId, shipId })
          close()
        }
        if (!items.length) {
          setTimeout(close)
          return null
        }
        const lines = noticeLines(state, items)
        const free = items.filter((n) => n.reason !== 'offers').length
        const title =
          free === 0
            ? 'Satamaan tuli uusia rahtitarjouksia'
            : free === items.length
              ? free === 1
                ? 'Laiva odottaa käskyjä'
                : `${free} laivaa odottaa käskyjä`
              : 'Laivat odottavat käskyjä'
        return (
          <div className="modal-back">
            <div className="modal" role="alertdialog" aria-modal="true">
              <h2>{title}</h2>
              <ul className="idle-list">
                {lines.map((l) => (
                  <li key={l.key}>
                    <span>{l.text}</span>
                    <button onClick={() => show(l.portId, l.shipId)}>{l.offers ? 'Näytä tarjoukset' : 'Näytä'}</button>
                  </li>
                ))}
              </ul>
              <div className="event-options">
                <button onClick={close}>Jatka</button>
              </div>
            </div>
          </div>
        )
      })()}

      {yearShown !== null && !state.pendingEvent && <YearReviewDialog state={state} year={yearShown} onClose={() => setYearShown(null)} />}

      {awards.length > 0 && yearShown === null && !state.pendingEvent && (
        <MilestoneDialog
          ids={awards}
          onClose={() => setAwards([])}
          onShowGoals={() => {
            setAwards([])
            setSelection(null)
            setRootTab('goals')
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
            setAwards([])
            setYearShown(null)
            flash('Tallennus ladattu.')
          } catch (err) {
            flash((err as Error).message)
          }
        }}
      />
    </div>
  )
}

interface NoticeLine {
  key: string
  text: string
  portId: string
  shipId: string
  offers: boolean
}

/**
 * One line per ship that just became free, and one line per port whose
 * freight board renewed (however many ships wait there), so a busy week
 * change gives one short list instead of a flood of popups.
 */
function noticeLines(state: GameState, notices: IdleNotice[]): NoticeLine[] {
  const lines: NoticeLine[] = []
  const waiting = new Map<string, OwnedShip[]>()
  for (const n of notices) {
    const ship = state.ships.find((s) => s.id === n.shipId)
    if (!ship?.portId) continue
    if (n.reason === 'offers') {
      const list = waiting.get(ship.portId) ?? []
      if (!list.some((s) => s.id === ship.id)) list.push(ship)
      waiting.set(ship.portId, list)
      continue
    }
    const port = getPort(ship.portId).name
    lines.push({
      key: ship.id + n.reason,
      portId: ship.portId,
      shipId: ship.id,
      offers: false,
      text:
        n.reason === 'arrived'
          ? `${ship.name} saapui satamaan ${port} ja odottaa uutta rahtia.`
          : `${ship.name} on korjattu satamassa ${port} ja on valmis lähtöön.`,
    })
  }
  for (const [portId, ships] of waiting) {
    const offers = portOffers(state, portId)
    const fits = ships.map((s) => {
      const t = getShipType(s.typeId)
      return offers.filter((o) => offerFits(s, t, o) === null).length
    })
    const best = ships[fits.indexOf(Math.max(...fits))]
    const who =
      ships.length === 1
        ? `${ships[0].name} odottaa siellä, ja sille sopii ${fits[0]} kpl.`
        : `Siellä odottaa ${ships.length} laivaa: ${ships.map((s, i) => `${s.name} (${fits[i]} sopii)`).join(', ')}.`
    lines.push({
      key: `offers-${portId}`,
      portId,
      shipId: best.id,
      offers: true,
      text: `${getPort(portId).name}: ${offers.length} uutta rahtitarjousta. ${who}`,
    })
  }
  return lines
}
