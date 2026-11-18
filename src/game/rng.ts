// Small deterministic RNG so markets are reproducible from the save's seed.

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: <T>(items: T[], weight: (t: T) => number = () => 1): T => {
      const total = items.reduce((s, i) => s + weight(i), 0)
      let r = next() * total
      for (const i of items) {
        r -= weight(i)
        if (r <= 0) return i
      }
      return items[items.length - 1]
    },
  }
}
