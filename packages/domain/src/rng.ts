/**
 * Seeded PRNG — `sfc32`. See docs/adr/0002-prng.md.
 *
 * The only dependency `domain` is permitted (ground rule 1), and it is written
 * here rather than installed.
 *
 * The design constraint is not randomness quality, it is **exact save/restore**:
 * a career saved in February must produce the same March that an uninterrupted
 * run would have. `sfc32`'s entire state is four uint32s, so `state()` round-trips
 * through JSON losslessly and `createRng(state)` resumes the stream precisely.
 * That is why `Math.random()` is banned — its state lives inside the JS engine,
 * unreadable and unrestorable.
 *
 * Consequence, deliberate: reloading a save cannot change a match result.
 */

/** Complete generator state. Four uint32s — serialise it, restore it, resume exactly. */
export type RngState = readonly [number, number, number, number]

export interface Rng {
  /** Next draw in [0, 1). */
  next(): number
  /** Snapshot for persistence. Pass back to `createRng` to resume the stream. */
  state(): RngState
}

/**
 * sfc32's authors recommend discarding the first rounds after seeding, so that a
 * low-entropy seed (1, 2, 3 — exactly what tests and fixtures use) has mixed
 * before the first draw is taken.
 */
const WARMUP_ROUNDS = 12

/**
 * Expands a single 32-bit seed into four well-distributed words. Seeding all four
 * of sfc32's words from the same number correlates the early output badly.
 */
function splitmix32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x9e3779b9) | 0
    let t = a ^ (a >>> 16)
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ (t >>> 15)
    t = Math.imul(t, 0x735a2d97)
    return (t ^ (t >>> 15)) >>> 0
  }
}

/**
 * Creates a generator from either a seed (fresh stream, warmed up) or a previously
 * captured state (resumes exactly where it left off — no warm-up, which would
 * desynchronise the restored stream from the original).
 */
export function createRng(seed: number | RngState): Rng {
  let a: number
  let b: number
  let c: number
  let d: number

  const step = (): number => {
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }

  if (typeof seed === 'number') {
    const mix = splitmix32(seed)
    a = mix()
    b = mix()
    c = mix()
    d = mix()
    for (let i = 0; i < WARMUP_ROUNDS; i++) step()
  } else {
    a = seed[0] | 0
    b = seed[1] | 0
    c = seed[2] | 0
    d = seed[3] | 0
  }

  return {
    next: step,
    state: (): RngState => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
  }
}

/**
 * Fisher–Yates over an injected generator. Returns a new array; the input is not
 * touched.
 *
 * Lives here rather than in the module that first needed it: a shuffle is a
 * property of the generator, not of the thing being shuffled. It came out of
 * `market.ts`, which used it to rotate the order clubs are served in a transfer
 * window, when the market screen needed the same thing to order its listings.
 *
 * Seeded, so a shuffle is reproducible — `Math.random` would break both
 * determinism in the domain and stable ordering on a screen that re-renders.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const a = result[i]
    const b = result[j]
    /* c8 ignore next */
    if (a === undefined || b === undefined) continue
    result[i] = b
    result[j] = a
  }
  return result
}
