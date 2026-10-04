import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { problems, renderCss, type TokenFile } from '../scripts/tokens.ts'

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const file = JSON.parse(read('./tokens.json')) as TokenFile

describe('tokens', () => {
  it('follows every rule the Design System artifact needs', () => {
    expect(problems(file)).toEqual([])
  })

  it('matches the committed tokens.css, so nobody edits the generated file by hand', () => {
    // Fails after editing tokens.json without `pnpm --filter @fm/design-system tokens:build`.
    expect(read('./tokens.css')).toBe(renderCss(file))
  })

  it('refuses an alias, a mix and a named colour', () => {
    const broken: TokenFile = {
      ...file,
      color: {
        ...file.color,
        tokens: [
          { name: 'a', value: 'var(--fm-ink)', usage: 'x' },
          { name: 'b', value: 'color-mix(in srgb, #fff, #000)', usage: 'x' },
          { name: 'c', value: 'white', usage: 'x' },
          { name: 'c', value: '#fff', usage: 'x' },
        ],
      },
    }
    expect(problems(broken)).toEqual([
      'color: a = "var(--fm-ink)" is not a concrete value',
      'color: a = "var(--fm-ink)" is not a hex, rgb() or hsl() colour',
      'color: b = "color-mix(in srgb, #fff, #000)" is not a concrete value',
      'color: b = "color-mix(in srgb, #fff, #000)" is not a hex, rgb() or hsl() colour',
      'color: c = "white" is not a hex, rgb() or hsl() colour',
      'color: "c" is defined twice',
    ])
  })
})
