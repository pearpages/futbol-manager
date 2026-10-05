import { readFileSync, writeFileSync } from 'node:fs'
import { problems, renderCss, renderSwatchCss, type TokenFile } from './tokens.ts'

const json = new URL('../src/tokens.json', import.meta.url)
const css = new URL('../src/tokens.css', import.meta.url)
const swatches = new URL('../src/foundations/swatches.css', import.meta.url)

const file = JSON.parse(readFileSync(json, 'utf8')) as TokenFile
const found = problems(file)
if (found.length > 0) {
  console.error(`tokens.json is invalid:\n${found.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}
writeFileSync(css, renderCss(file))
writeFileSync(swatches, renderSwatchCss(file))
console.log(`tokens.css written: ${String(renderCss(file).split('--fm-').length - 1)} tokens`)
