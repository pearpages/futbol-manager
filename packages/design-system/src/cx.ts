/**
 * Joins class names, dropping empties and collapsing whitespace, so a wrapper's
 * own class and a caller's extra ones come out exactly as one hand-written
 * `className` would.
 */
export function cx(...parts: readonly (string | false | null | undefined)[]): string {
  return parts
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .split(/\s+/)
    .filter((name) => name !== '')
    .join(' ')
}
