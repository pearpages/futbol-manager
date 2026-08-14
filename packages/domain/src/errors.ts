/**
 * Refusals the player will actually read.
 *
 * The reducer has always thrown plain English sentences, and two screens render
 * `thrown.message` straight into a `role="alert"`. That was fine while the game
 * spoke one language and became a hole the moment it spoke three.
 *
 * **The sentence stays.** `GameError` carries a `code` and its `params` *and*
 * keeps the same `message` it always had. That buys three things: the app can
 * translate from the code, anything that has not been translated still says
 * something sensible, and every existing test that matches on the message text
 * goes on passing — so this change is additive rather than a rewrite with a
 * hundred assertions riding on it.
 *
 * `domain` still owns no word list in the sense ground rule 1 means: these are
 * developer-facing error text, the same as every other `throw` in the package.
 * The *player-facing* copy lives in the app, keyed by `code`.
 *
 * Only refusals get a code. The invariant throws elsewhere in `domain` — a
 * desynced carousel, a lineup with two goalkeepers — are bugs, not decisions a
 * player made, and nothing shows them.
 */
export class GameError extends Error {
  readonly code: string
  readonly params: Readonly<Record<string, string | number>>

  constructor(code: string, message: string, params: Record<string, string | number> = {}) {
    super(message)
    this.name = 'GameError'
    this.code = code
    this.params = params
  }
}

/** Narrows a caught value, since `catch` gives you `unknown`. */
export function isGameError(thrown: unknown): thrown is GameError {
  return thrown instanceof GameError
}
