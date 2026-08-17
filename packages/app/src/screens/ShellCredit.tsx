import { useT } from '../i18n/useT.ts'
import '../styles/shell-credit.css'

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
    </footer>
  )
}
