import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { buildStamp } from './commit.ts'

export default defineConfig({
  plugins: [react()],
  /*
   * The build stamps its own release tag, or else its commit, which the footer
   * shows (ADR 0020).
   *
   * Defined on `import.meta.env` rather than as a bare `__COMMIT__` global, and
   * that is not a style choice. The root `vitest.config.ts` declares the app
   * project **inline** — its own `plugins` and `root` — and does not extend this
   * file, so a bare global would simply not exist under Vitest and every test
   * that renders the footer would throw a `ReferenceError` at import. An absent
   * `import.meta.env` key is `undefined`, which the call site's `?? 'dev'`
   * absorbs, so the same code is correct in a build, in `pnpm dev` and in a test.
   */
  define: {
    'import.meta.env.VITE_COMMIT': JSON.stringify(buildStamp()),
  },
})
