/// <reference types="vite/client" />

/**
 * The build's commit hash, baked in by `define` in `vite.config.ts`.
 *
 * Optional on purpose: it is genuinely absent under Vitest and under `pnpm dev`,
 * and the type should say so rather than let a call site skip the fallback.
 */
interface ImportMetaEnv {
  readonly VITE_COMMIT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
