import { useEffect, useRef, useState } from 'react'

/** Real milliseconds per game day at each speed setting. */
export const SPEEDS = [
  { label: '▶', msPerDay: 1200 },
  { label: '▶▶', msPerDay: 500 },
  { label: '▶▶▶', msPerDay: 180 },
] as const

/**
 * Drives game time. Calls `onDay` once per elapsed game day and exposes the
 * fraction of the current day (0–1) so ships can glide smoothly.
 */
export function useClock(running: boolean, speed: number, onDay: () => void) {
  const [fraction, setFraction] = useState(0)
  const frac = useRef(0)
  const cb = useRef(onDay)
  cb.current = onDay

  useEffect(() => {
    if (!running) return
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const ms = SPEEDS[speed].msPerDay
      frac.current += Math.min(now - last, 250) / ms
      last = now
      if (frac.current >= 1) {
        frac.current -= 1
        cb.current()
      }
      setFraction(frac.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, speed])

  const reset = () => {
    frac.current = 0
    setFraction(0)
  }
  return { fraction, reset }
}
