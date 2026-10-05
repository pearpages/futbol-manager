/**
 * Layout checks that run inside the page (ADR 0023). Each returns what failed,
 * so a test can name it. They are self-contained on purpose: Playwright sends a
 * function's source to the browser, so nothing here may reach outside itself.
 *
 * They assert what a player would see broken, not pixels, so they need no
 * reference images and hold across machines and fonts.
 */

/** How far the page scrolls sideways. Zero, at every width (P20). */
export function sidewaysScroll(): number {
  return document.documentElement.scrollWidth - document.documentElement.clientWidth
}

/** Controls a thumb would miss: smaller than 24px either way (WCAG 2.5.8). */
export function smallTargets(): string[] {
  return [...document.querySelectorAll('button, a[href], select, input, [role=button]')]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24)
    })
    .map((el) =>
      (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 30),
    )
}

/** Text below WCAG AA against what is actually behind it (4.5:1, 3:1 when large). */
export function lowContrast(): string[] {
  const parse = (c: string) => {
    const m = /rgba?\(([^)]+)\)/.exec(c)
    if (m === null) return null
    const p = (m[1] ?? '')
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number)
    return { r: p[0] ?? 0, g: p[1] ?? 0, b: p[2] ?? 0, a: p.length > 3 ? (p[3] ?? 1) : 1 }
  }
  type C = { r: number; g: number; b: number; a: number }
  const lum = ({ r, g, b }: C) => {
    const f = (v: number) => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const blend = (top: C, under: C): C => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  })
  const background = (el: Element) => {
    const layers: C[] = []
    for (let e: Element | null = el; e !== null; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor)
      if (c !== null && c.a > 0) {
        layers.push(c)
        if (c.a >= 1) break
      }
    }
    let bg: C = { r: 10, g: 18, b: 12, a: 1 }
    for (const layer of layers.reverse()) bg = blend(layer, bg)
    return bg
  }
  const failed: string[] = []
  const seen = new Set<Element>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement
    if (el === null || seen.has(el) || (walker.currentNode.textContent ?? '').trim() === '')
      continue
    seen.add(el)
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (cs.visibility === 'hidden' || r.width < 2 || r.height < 2) continue
    if (el.closest('.visually-hidden, [aria-hidden=true], svg, button:disabled')) continue
    const fg0 = parse(cs.color)
    if (fg0 === null) continue
    const bg = background(el)
    const fg = blend({ ...fg0, a: fg0.a * Number(cs.opacity) }, bg)
    const [a, b] = [lum(fg), lum(bg)]
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    const size = Number.parseFloat(cs.fontSize)
    const large = size >= 24 || (Number(cs.fontWeight) >= 700 && size >= 18.66)
    if (ratio < (large ? 3 : 4.5)) {
      failed.push(
        `${ratio.toFixed(2)}:1 "${(walker.currentNode.textContent ?? '').trim().slice(0, 30)}"`,
      )
    }
  }
  return failed
}

/** Text closer than 8px to the edge of the panel, screen or dialog that holds it. */
export function tightText(): string[] {
  const failed: string[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    const el = node.parentElement
    if (el === null || (node.textContent ?? '').trim() === '') continue
    if (el.closest('.visually-hidden, [aria-hidden=true], svg, .button, button')) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const range = document.createRange()
    range.selectNodeContents(node)
    const r = range.getBoundingClientRect()
    if (r.width < 2) continue
    const box = el.closest('.modal__body, .screen, .panel')
    if (box === null) continue
    const b = box.getBoundingClientRect()
    const gap = Math.min(r.left - b.left, b.right - r.right)
    if (gap < 8)
      failed.push(`${Math.round(gap)}px "${(node.textContent ?? '').trim().slice(0, 30)}"`)
  }
  return failed
}
