import { execFileSync } from 'node:child_process'

/**
 * The short hash of the commit this build came from, for the footer.
 *
 * Config-side, and deliberately outside `src/` so it can never be pulled into
 * the bundle — it reaches for `node:child_process`, which has no business in a
 * browser. `vite.config.ts` is its only caller, and it bakes the answer in as a
 * literal via `define`.
 *
 * **Never throws.** A tarball with no `.git`, a build container without git on
 * the PATH, a detached worktree mid-rebase — none of those are reasons to fail a
 * build over a decoration in the footer. They all read `dev`, which is also what
 * `pnpm dev` and the test run show, since neither goes through `define`.
 *
 * `execFileSync` rather than `execSync`: no shell, so nothing here is
 * interpolated into one.
 */
export function commitHash(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: import.meta.dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'dev'
  }
}
