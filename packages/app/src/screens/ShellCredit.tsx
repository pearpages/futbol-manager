import { ShellCredit as ShellCreditView } from '@fm/design-system'
import { useT } from '../i18n/useT.ts'

/**
 * Which build this is.
 *
 * Read once at module load — it is a literal substituted by `define`, so there is
 * nothing to re-evaluate. The fallback is not defensive padding: the key is
 * genuinely absent under `pnpm dev` and under Vitest, which is why the test
 * asserts the *shape* rather than a value that changes every commit.
 */
const COMMIT = import.meta.env.VITE_COMMIT ?? 'dev'

/** The family credit, in the player's language and stamped with this build. */
export function ShellCredit(): React.JSX.Element {
  const { t } = useT()
  return (
    <ShellCreditView
      madeBy={t('shell.madeBy')}
      buildLabel={t('shell.build')}
      commit={COMMIT}
      iconSrc="/pearpages-icon.png"
    />
  )
}
