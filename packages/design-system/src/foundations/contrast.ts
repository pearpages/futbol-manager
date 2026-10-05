/** WCAG contrast between two hex colours, for the foundations' ink table. */
export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const h = hex.replace('#', '')
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
    const [r, g, bl] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255)
    const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r ?? 0) + 0.7152 * f(g ?? 0) + 0.0722 * f(bl ?? 0)
  }
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
