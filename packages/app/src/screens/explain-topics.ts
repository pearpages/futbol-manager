import { FINANCE, MAX_SQUAD, MIN_SQUAD } from '@fm/domain'
import type { Params } from '../i18n/index.ts'
import type { Translator } from '../i18n/useT.ts'

/**
 * Everything the game decides without saying so, as a list of topics an
 * `<Explain />` button can open.
 *
 * **The rule the copy is written to.** The screen states the *mechanism*; the
 * modal adds a *direction*; neither states the number. "A dearer ticket takes
 * more per head and empties seats" on the screen, "dearer than the default pays,
 * but the top of the slider is worse than leaving it alone" in the modal, and
 * never "the best price is 1.5×". A mechanic nobody can see is a bad game; a
 * lookup table of right answers is not a game at all.
 *
 * **Where a number does appear it comes from the domain, never from a
 * dictionary.** `CLAUDE.md` is emphatic that prose naming a number a constant
 * also names is drift waiting to happen, and this file would be the worst place
 * in the codebase to break that rule — help text that contradicts the game is
 * worse than no help text. So `params` reads the live constant and the sentence
 * carries a `{placeholder}`.
 *
 * Named with a dash rather than `Explain.ts` so it cannot collide with
 * `Explain.tsx` on a case-insensitive filesystem, which macOS is by default.
 */

export interface ExplainTopic {
  /**
   * How many paragraphs the body has. Keys are `explain.<id>.p1` … `.pN`, and
   * the title is `explain.<id>.title`.
   *
   * A count rather than an array of keys because the keys are mechanical, and a
   * second list of them is a second thing to keep in step.
   */
  readonly paragraphs: number
  /** Live values for the `{placeholders}`, or absent when the copy has none. */
  readonly params?: (translator: Translator) => Params
}

export const EXPLAIN_TOPICS = {
  // ── The ground ──────────────────────────────────────────────────────────
  occupancy: { paragraphs: 2 },
  ticket: { paragraphs: 2 },
  expansion: {
    paragraphs: 2,
    params: ({ count }) => ({
      min: count(FINANCE.MIN_EXPANSION),
      max: count(FINANCE.MAX_EXPANSION),
    }),
  },

  /*
   * ── The squad ────────────────────────────────────────────────────────────
   *
   * One topic covering the whole table rather than four beside four columns,
   * and that is forced rather than chosen. `SortHeader` states its contract
   * outright — "the header's accessible name is the column label and several
   * tests resolve headers by it" — so an "i" inside a sortable `<th>` renames
   * the column it explains. The squad screen has no note region either, so the
   * heading is the only place left.
   */
  squadTable: {
    paragraphs: 9,
    params: ({ count }) => ({ min: count(MIN_SQUAD), max: count(MAX_SQUAD) }),
  },

  // ── The team sheet ──────────────────────────────────────────────────────
  teamRating: { paragraphs: 3 },
  tempo: { paragraphs: 3 },
  approach: { paragraphs: 2 },
} as const satisfies Readonly<Record<string, ExplainTopic>>

export type ExplainTopicId = keyof typeof EXPLAIN_TOPICS

export const EXPLAIN_TOPIC_IDS = Object.keys(EXPLAIN_TOPICS) as ExplainTopicId[]

/** Every dictionary key a topic owns — the title and each paragraph. */
export function keysFor(id: ExplainTopicId): string[] {
  const { paragraphs } = EXPLAIN_TOPICS[id]
  return [
    `explain.${id}.title`,
    ...Array.from({ length: paragraphs }, (_, i) => `explain.${id}.p${String(i + 1)}`),
  ]
}
