import { useEffect, useRef, useState } from 'react'
import { getPort } from '../data/ports'
import { hashString, rng } from '../game/rng'
import type { DockingResult } from '../game/sim'

// Steer-into-port minigame. Canvas 320×400 "pixels", scaled up crisply.
// Controls: arrows / WASD, or the on-screen buttons on touch screens.

const W = 320
const H = 400
const TIME_LIMIT = 90
const SHIP_R = 7

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Layout {
  walls: Rect[]
  moored: Rect[]
  berth: Rect
  start: { x: number; y: number; heading: number }
}

/** A harbour layout per port: breakwater with a gap, quays, moored ships, a free berth. */
function makeLayout(portId: string): Layout {
  const r = rng(hashString(`dock:${portId}`))
  const gapX = r.int(70, 200)
  const gapW = r.int(56, 74)
  const bwY = r.int(250, 280)
  const walls: Rect[] = [
    // quay along the top and sides of the basin
    { x: 0, y: 0, w: W, h: 36 },
    { x: 0, y: 0, w: 18, h: bwY },
    { x: W - 18, y: 0, w: 18, h: bwY },
    // breakwater with a gap
    { x: 0, y: bwY, w: gapX, h: 14 },
    { x: gapX + gapW, y: bwY, w: W - gapX - gapW, h: 14 },
  ]
  // a pier sticking into the basin
  const pierX = r.int(90, 230)
  walls.push({ x: pierX, y: 36, w: 14, h: r.int(60, 110) })
  // berths along the top quay: one free, the rest taken
  const slots = [26, 74, 122, 170, 218, 266].filter((x) => x + 40 < pierX - 2 || x > pierX + 16)
  const free = r.pick(slots)
  const moored = slots.filter((x) => x !== free && r.next() < 0.75).map((x) => ({ x: x + 4, y: 38, w: 30, h: 46 }))
  return {
    walls,
    moored,
    berth: { x: free, y: 38, w: 40, h: 54 },
    start: { x: gapX + gapW / 2, y: H - 30, heading: -Math.PI / 2 },
  }
}

function circleHitsRect(cx: number, cy: number, r: number, b: Rect) {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w))
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h))
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r
}

interface Props {
  portId: string
  shipName: string
  onDone: (result: DockingResult) => void
}

export function DockingGame({ portId, shipName, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keys = useRef({ up: false, down: false, left: false, right: false })
  const [hud, setHud] = useState({ time: TIME_LIMIT, hits: 0, speed: 0 })
  const [result, setResult] = useState<DockingResult | null>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const layout = makeLayout(portId)
    const ctx = canvasRef.current!.getContext('2d')!
    const ship = { ...layout.start, speed: 0 }
    let hits = 0
    let graceUntil = 0
    let t = 0
    let finished = false
    let last = performance.now()
    let raf = 0
    let hudTick = 0

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const map: Record<string, keyof typeof keys.current> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }
      if (map[k]) {
        keys.current[map[k]] = down
        e.preventDefault()
      }
    }
    const kd = onKey(true)
    const ku = onKey(false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    const finish = (res: DockingResult) => {
      if (finished) return
      finished = true
      setResult(res)
    }

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!finished) {
        t += dt
        const k = keys.current
        // Throttle: up accelerates, down brakes and then reverses slowly.
        const accel = k.up ? 9 : k.down ? -9 : 0
        ship.speed += accel * dt
        ship.speed -= ship.speed * 0.35 * dt // water drag
        ship.speed = Math.max(-10, Math.min(28, ship.speed))
        // Rudder only bites when moving.
        const steer = (k.left ? -1 : 0) + (k.right ? 1 : 0)
        ship.heading += steer * dt * Math.min(1.4, Math.abs(ship.speed) / 10) * Math.sign(ship.speed || 1)
        const nx = ship.x + Math.cos(ship.heading) * ship.speed * dt
        const ny = ship.y + Math.sin(ship.heading) * ship.speed * dt
        const solid = [...layout.walls, ...layout.moored]
        const hit = solid.some((b) => circleHitsRect(nx, ny, SHIP_R, b)) || nx < SHIP_R || nx > W - SHIP_R || ny > H - SHIP_R
        if (hit) {
          if (t > graceUntil && Math.abs(ship.speed) > 3) {
            hits++
            graceUntil = t + 1
          }
          ship.speed = -ship.speed * 0.3
        } else {
          ship.x = nx
          ship.y = ny
        }
        const b = layout.berth
        if (ship.x > b.x + 6 && ship.x < b.x + b.w - 6 && ship.y > b.y + 6 && ship.y < b.y + b.h - 4 && Math.abs(ship.speed) < 4) {
          finish({ success: true, hits })
        } else if (t >= TIME_LIMIT) {
          finish({ success: false, hits })
        }
        if (now - hudTick > 150) {
          hudTick = now
          setHud({ time: Math.max(0, Math.ceil(TIME_LIMIT - t)), hits, speed: ship.speed })
        }
      }
      draw(ctx, layout, ship, t)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
  }, [portId])

  const hold = (k: keyof typeof keys.current) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      keys.current[k] = true
    },
    onPointerUp: () => (keys.current[k] = false),
    onPointerLeave: () => (keys.current[k] = false),
    onPointerCancel: () => (keys.current[k] = false),
  })

  return (
    <div className="modal-back">
      <div className="modal docking" role="dialog" aria-modal="true">
        <h2>Satamaan: {getPort(portId).name}</h2>
        <p className="muted">
          Ohjaa {shipName} vihreälle laituripaikalle hitaasti. Nuolinäppäimet tai WASD, puhelimella alla olevat napit.
        </p>
        <div className="dock-hud">
          <span>⏱ {hud.time} s</span>
          <span>Nopeus {Math.abs(hud.speed).toFixed(1)} {hud.speed < -0.2 ? '(peruutus)' : ''}</span>
          <span className={hud.hits ? 'neg' : ''}>Kolhut {hud.hits}</span>
        </div>
        <canvas ref={canvasRef} width={W} height={H} className="dock-canvas" />
        {result ? (
          <div className="dock-result">
            <strong>
              {result.success && result.hits === 0 && 'Täydellinen rantautuminen! Säästät luotsimaksun.'}
              {result.success && result.hits > 0 && `Laiturissa, mutta ${result.hits} kolhua.`}
              {!result.success && 'Aika loppui: luotsi ohjaa laivan laituriin.'}
            </strong>
            <button className="primary" onClick={() => done.current(result)} autoFocus>
              Jatka
            </button>
          </div>
        ) : (
          <div className="dock-controls">
            <button {...hold('left')} aria-label="Vasemmalle">
              ⟲
            </button>
            <button {...hold('up')} aria-label="Eteenpäin">
              ▲
            </button>
            <button {...hold('down')} aria-label="Jarruta / peruuta">
              ▼
            </button>
            <button {...hold('right')} aria-label="Oikealle">
              ⟳
            </button>
            <button className="small skip" onClick={() => done.current({ success: false, hits: 0 })}>
              Anna luotsin hoitaa
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function draw(ctx: CanvasRenderingContext2D, layout: Layout, ship: { x: number; y: number; heading: number; speed: number }, t: number) {
  // water
  ctx.fillStyle = '#1d5a85'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#2a6d9b'
  for (let y = 0; y < H; y += 12) {
    for (let x = ((y / 12) % 2) * 10 + ((t * 6) % 20) - 20; x < W; x += 20) ctx.fillRect(Math.round(x), y, 6, 2)
  }
  // berth
  const b = layout.berth
  ctx.fillStyle = 'rgba(80, 200, 120, 0.35)'
  ctx.fillRect(b.x, b.y, b.w, b.h)
  ctx.strokeStyle = '#7dff9e'
  ctx.setLineDash([4, 3])
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1)
  ctx.setLineDash([])
  // walls
  for (const w of layout.walls) {
    ctx.fillStyle = '#8c8577'
    ctx.fillRect(w.x, w.y, w.w, w.h)
    ctx.fillStyle = '#a9a291'
    ctx.fillRect(w.x, w.y, w.w, 3)
    ctx.fillStyle = '#5d584e'
    ctx.fillRect(w.x, w.y + w.h - 2, w.w, 2)
  }
  // bollards on the quay
  ctx.fillStyle = '#3b3833'
  for (let x = 24; x < W - 20; x += 24) ctx.fillRect(x, 32, 3, 3)
  // moored ships
  for (const m of layout.moored) {
    ctx.fillStyle = '#3c2f2f'
    ctx.fillRect(m.x, m.y, m.w, m.h)
    ctx.fillStyle = '#b5402a'
    ctx.fillRect(m.x + 3, m.y + 6, m.w - 6, m.h - 18)
    ctx.fillStyle = '#e9e4d8'
    ctx.fillRect(m.x + 7, m.y + m.h - 12, m.w - 14, 8)
  }
  // player ship (bow points along heading)
  ctx.save()
  ctx.translate(ship.x, ship.y)
  ctx.rotate(ship.heading + Math.PI / 2)
  if (Math.abs(ship.speed) > 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(-5, 12, 2, 4)
    ctx.fillRect(3, 12, 2, 4)
  }
  ctx.fillStyle = '#1b1b1b'
  ctx.beginPath()
  ctx.moveTo(0, -14)
  ctx.lineTo(7, -6)
  ctx.lineTo(7, 12)
  ctx.lineTo(-7, 12)
  ctx.lineTo(-7, -6)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#c8501e'
  ctx.fillRect(-5, -6, 10, 9)
  ctx.fillStyle = '#f3ead6'
  ctx.fillRect(-5, 5, 10, 5)
  ctx.restore()
}
