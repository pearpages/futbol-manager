import type { StorybookConfig } from '@storybook/react-vite'

/**
 * Every screen of the game, in the states worth looking at, at phone, tablet
 * and desktop widths. A dev tool: it is never deployed. See ADR 0017.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  staticDirs: ['../public'],
}

export default config
