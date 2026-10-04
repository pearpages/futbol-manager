/**
 * Fails the build if `dist/bundle.js` is not what the Claude Design System
 * artifact can load: one classic script, nothing to fetch, nothing to resolve.
 * See ADR 0016.
 */
import { readFileSync } from 'node:fs'

const js = readFileSync(new URL('../dist/bundle.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../dist/bundle.css', import.meta.url), 'utf8')

const rules: readonly [string, boolean][] = [
  ['assigns window.FutbolDesignSystem', /\bvar FutbolDesignSystem\s*=/.test(js)],
  ['contains no "</script" (it is inlined into a page)', !/<\/script/i.test(js)],
  ['has no static import or export statement', !/^\s*(import|export)\s/m.test(js)],
  ['has no dynamic import()', !/\bimport\s*\(/.test(js)],
  ['has no require()', !/\brequire\s*\(/.test(js)],
  [
    'makes no network calls',
    !/\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon)/.test(js),
  ],
  ['bundle.css carries the tokens', css.includes('--fm-screen:')],
  ['bundle.css carries the chrome', css.includes('.screen__heading')],
]

const failed = rules.filter(([, ok]) => !ok).map(([rule]) => rule)
if (failed.length > 0) {
  console.error(
    `dist/bundle.js is not loadable as the artifact needs:\n${failed.map((r) => `  - ${r}`).join('\n')}`,
  )
  process.exit(1)
}
console.log(
  `bundle ok: ${String(Math.round(js.length / 1024))} kB js, ${String(Math.round(css.length / 1024))} kB css`,
)
