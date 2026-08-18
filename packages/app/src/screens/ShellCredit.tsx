import { useT } from '../i18n/useT.ts'
import '../styles/shell-credit.css'

/**
 * Which build this is.
 *
 * Read once at module load — it is a literal substituted by `define`, so there is
 * nothing to re-evaluate. The fallback is not defensive padding: the key is
 * genuinely absent under `pnpm dev` and under Vitest, which is why the test
 * asserts the *shape* rather than a value that changes every commit.
 */
const COMMIT = import.meta.env.VITE_COMMIT ?? 'dev'

/**
 * The signature every site in the family carries — same mark, same wording, same
 * destination. It is a network credit, not an authorship claim: it says this page
 * belongs with the others.
 *
 * Its own component because the shell has **two** branches — the club picker
 * replaces the whole frame before a career exists — and a footer belongs in both.
 * A single literal in `App.tsx` would have been two literals.
 *
 * **On the whole-sentence rule.** `i18n/index.ts` is emphatic that a sentence is
 * one key and never assembled from fragments, because word order moves between
 * languages. This splits one, and the exception is narrow enough to state: the
 * second fragment is a **proper noun that is never translated** — the same class
 * as a club or a player name — and it lands last in all three (`Fet per X` ·
 * `Hecho por X` · `Made by X`). The alternative, one key carrying `{name}`,
 * cannot work here because the substituted fragment has to be an `<a>` rather
 * than text; that is the same trade the news feed made when player names became
 * links, and it was settled the same way.
 */
export function ShellCredit(): React.JSX.Element {
  const { t } = useT()

  return (
    <footer className="shell__credit">
      {/* Decorative: the accessible name of the credit is the words beside it,
          and the link's own name must stay exactly `pearpages`. */}
      <img className="shell__credit-icon" src="/pearpages-icon.png" alt="" width="16" height="16" />
      {t('shell.madeBy')}{' '}
      <a
        className="shell__credit-link"
        href="https://pearpages.com"
        target="_blank"
        rel="author noopener"
      >
        pearpages
      </a>
      {/* A real text node, not a CSS gap. The gap spaces it on screen and
          contributes nothing to `textContent`, which is what assistive technology
          reads — and `pearpages7f1e3eb` is the exact defect this project has now
          shipped five times (`CanteraM7`, `20Relegated`, `Temporada 1En joc`, the
          calendar score cell, `Matchday 12026-08-15`). */}
      {' · '}
      <span className="shell__credit-version" title={t('shell.build')}>
        {COMMIT}
      </span>
    </footer>
  )
}
