import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** A built Storybook's stories, read from its index so the list never drifts. */
export interface StoryEntry {
  readonly id: string
  readonly title: string
}

export function stories(): readonly StoryEntry[] {
  const file = resolve(import.meta.dirname, '../packages/app/storybook-static/index.json')
  const index = JSON.parse(readFileSync(file, 'utf8')) as {
    entries: Record<string, { id: string; title: string; type: string }>
  }
  return Object.values(index.entries).filter((entry) => entry.type === 'story')
}

export const WIDTHS = [
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'tablet', width: 768, height: 1024, touch: false },
  { name: 'desk', width: 1280, height: 800, touch: false },
] as const

/** The story alone, as Storybook's preview frame renders it, in Catalan. */
export const storyUrl = (id: string) => `/iframe.html?id=${id}&viewMode=story&globals=language:ca`
