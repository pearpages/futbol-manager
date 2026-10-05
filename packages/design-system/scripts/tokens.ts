/**
 * `tokens.json` → `tokens.css`, and the rules a token file has to follow.
 *
 * `tokens.json` is the source of truth because the Claude Design System artifact
 * reads it as data. `tokens.css` is what the app and the bundle load, generated
 * from it, and committed so the app needs no build step to run.
 */

export interface Token {
  readonly name: string
  readonly value: string
  readonly usage: string
}

interface TokenList {
  readonly tokens: readonly Token[]
}

export interface TokenFile {
  readonly name: string
  readonly version: number
  readonly color: { readonly themes: readonly { id: string; name: string }[] } & TokenList
  readonly type: {
    readonly fonts: readonly { family: string; file: string; weight: string }[]
    readonly families: Readonly<Record<string, string>>
    readonly sizes: TokenList
    readonly tracking: TokenList
    readonly groups: readonly {
      name: string
      family: string
      styles: readonly { name: string; fontSize: string; lineHeight: string; fontWeight: string }[]
    }[]
  }
  readonly spacing: TokenList
  readonly radius: TokenList
  readonly shadow: TokenList
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/
/** A colour has to be concrete: hex, rgb() or hsl(). No aliases, no mixing, no names. */
const COLOUR = /^(#[0-9a-f]{3,8}|rgba?\([^()]*\)|hsla?\([^()]*\))$/i
/** A length: a number with a CSS unit, a percentage, or zero. */
const LENGTH = /^(0|-?\d*\.?\d+(px|rem|em|%))$/
/** `var(`, `color-mix(` and `calc(` all make a value depend on something else. */
const INDIRECT = /\b(var|color-mix|calc)\(/

/** Every token, flattened, with the CSS custom property each one becomes. */
export function allTokens(file: TokenFile): { group: string; token: Token }[] {
  const families = Object.entries(file.type.families).map(([name, value]) => ({
    group: 'families',
    token: { name, value, usage: '' },
  }))
  return [
    ...file.color.tokens.map((token) => ({ group: 'color', token })),
    ...families,
    ...file.type.sizes.tokens.map((token) => ({ group: 'sizes', token })),
    ...file.type.tracking.tokens.map((token) => ({ group: 'tracking', token })),
    ...file.spacing.tokens.map((token) => ({ group: 'spacing', token })),
    ...file.radius.tokens.map((token) => ({ group: 'radius', token })),
    ...file.shadow.tokens.map((token) => ({ group: 'shadow', token })),
  ]
}

/** Every rule the file breaks, as sentences. Empty means it is valid. */
export function problems(file: TokenFile): string[] {
  const found: string[] = []
  const seen = new Set<string>()

  for (const { group, token } of allTokens(file)) {
    if (!NAME.test(token.name)) found.push(`${group}: "${token.name}" is not a valid name`)
    if (seen.has(token.name)) found.push(`${group}: "${token.name}" is defined twice`)
    seen.add(token.name)
    if (INDIRECT.test(token.value))
      found.push(`${group}: ${token.name} = "${token.value}" is not a concrete value`)
    if (group === 'color' && !COLOUR.test(token.value))
      found.push(`color: ${token.name} = "${token.value}" is not a hex, rgb() or hsl() colour`)
    if (
      (group === 'sizes' || group === 'tracking' || group === 'spacing' || group === 'radius') &&
      !LENGTH.test(token.value)
    )
      found.push(`${group}: ${token.name} = "${token.value}" is not a length`)
    if (group !== 'families' && token.usage.trim() === '')
      found.push(`${group}: ${token.name} has no usage`)
  }

  for (const group of file.type.groups) {
    if (file.type.families[group.family] === undefined)
      found.push(`type group "${group.name}" names a missing family "${group.family}"`)
  }
  return found
}

/** The stylesheet, exactly as committed. */
export function renderCss(file: TokenFile): string {
  const lines = allTokens(file).map(({ token }) => `  --fm-${token.name}: ${token.value};`)
  return [
    '/*',
    ' * Generated from tokens.json by `pnpm --filter @fm/design-system tokens:build`.',
    ' * Do not edit: change tokens.json and rebuild. tokens.test.ts fails if this',
    ' * file and tokens.json disagree.',
    ' */',
    '',
    ':root {',
    ...lines,
    '}',
    '',
  ].join('\n')
}

/**
 * One class per token for the Storybook foundations (ADR 0021): a swatch's
 * colour, a spacing bar's width, a radius, a type size. Generated so the
 * stories show every token without an inline style (P15), and can never list
 * one the tokens no longer have.
 */
export function renderSwatchCss(file: TokenFile): string {
  const rule = (name: string): string | null => {
    const v = `var(--fm-${name})`
    if (/^text-/.test(name)) return `font-size: ${v};`
    if (/^track-/.test(name)) return `letter-spacing: ${v};`
    if (/^space-/.test(name)) return `inline-size: ${v};`
    if (/^radius-/.test(name)) return `border-radius: ${v};`
    if (/^shadow-/.test(name)) return `box-shadow: ${v};`
    if (/^font/.test(name)) return `font-family: ${v};`
    return null
  }
  const lines = allTokens(file).map(({ group, token }) => {
    if (group === 'color') {
      // A colour is shown both as a surface and as ink on one.
      return [
        `[data-token='${token.name}'] {\n  background: var(--fm-${token.name});\n}`,
        `[data-ink='${token.name}'] {\n  color: var(--fm-${token.name});\n}`,
      ].join('\n\n')
    }
    const declaration = rule(token.name)
    return declaration === null ? null : `[data-token='${token.name}'] {\n  ${declaration}\n}`
  })
  return [
    '/*',
    ' * Generated from tokens.json by `pnpm --filter @fm/design-system tokens:build`,',
    ' * for the Storybook foundations only. Do not edit; tokens.test.ts checks it.',
    ' */',
    '',
    lines.filter((line): line is string => line !== null).join('\n\n'),
    '',
  ].join('\n')
}
