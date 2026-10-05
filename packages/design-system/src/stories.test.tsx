import { composeStories } from '@storybook/react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * Every design-system story renders (ADR 0021): foundations, primitives and
 * components. A story that throws, or a component that no longer takes the
 * props its story passes, fails here rather than in someone's Storybook.
 */
const modules = import.meta.glob<Record<string, unknown>>('./**/*.stories.tsx', { eager: true })

const stories = Object.entries(modules).flatMap(([file, module]) =>
  Object.entries(composeStories(module as Parameters<typeof composeStories>[0])).map(
    ([name, Story]) =>
      [`${file.replace('./', '')} › ${name}`, Story as unknown as () => React.JSX.Element] as const,
  ),
)

afterEach(cleanup)

describe('the design-system stories', () => {
  it('finds stories at every level', () => {
    const files = Object.keys(modules)
    expect(files.some((f) => f.startsWith('./foundations/'))).toBe(true)
    expect(files.filter((f) => f.startsWith('./components/')).length).toBeGreaterThan(25)
  })

  it.each(stories)('%s renders', (_name, Story) => {
    render(<Story />)
    // Something beyond the empty mount: an image-only story has no text, and a
    // dialog renders into `body` rather than the container.
    expect(
      document.body.querySelectorAll('main *, body > .modal, nav, .toast').length,
    ).toBeGreaterThan(0)
  })
})
