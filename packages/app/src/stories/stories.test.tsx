import { composeStories, setProjectAnnotations } from '@storybook/react-vite'
import { describe, expect, it } from 'vitest'
import preview from '../../.storybook/preview.ts'
import * as screens from './Screens.stories.tsx'

/**
 * Every story renders. A screen that throws, or a scene that no longer reaches
 * its screen, fails here rather than in someone's Storybook.
 */
setProjectAnnotations(preview)
const stories = Object.entries(composeStories(screens))

describe('the screen stories', () => {
  it.each(stories)('%s renders the game', async (_name, Story) => {
    await Story.run()
    expect(document.querySelector('.shell')).not.toBeNull()
  })
})
