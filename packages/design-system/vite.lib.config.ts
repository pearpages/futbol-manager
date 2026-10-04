import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

/**
 * The standalone bundle, for the Claude Design System artifact. See ADRs 0015
 * and 0016.
 *
 * The app never uses this: it imports the package from source, like every other
 * workspace package. What this builds is one classic script that assigns
 * `window.FutbolDesignSystem`, with React and ReactDOM **inlined** rather than
 * external, because the artifact loads it with no module loader and no network,
 * plus one stylesheet and one rolled-up `index.d.ts`.
 */
export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: './tsconfig.build.json',
      entryRoot: 'src',
      bundleTypes: true,
    }),
  ],
  // React reads `process.env.NODE_ENV` to pick its production build. There is no
  // `process` in a browser, so the literal has to be baked in.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/bundle.ts',
      name: 'FutbolDesignSystem',
      formats: ['iife'],
      fileName: () => 'bundle.js',
      cssFileName: 'bundle',
    },
  },
})
