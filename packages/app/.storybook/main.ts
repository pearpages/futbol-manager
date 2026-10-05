import type { StorybookConfig } from '@storybook/react-vite'

/**
 * The design system in levels — foundations, primitives, components — and then
 * every screen of the game, at phone, tablet and desktop widths. A dev tool: it
 * is never deployed. See ADR 0017 and ADR 0021.
 */
const config: StorybookConfig = {
  stories: ['../../design-system/src/**/*.stories.tsx', '../src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  staticDirs: ['../public'],
}

export default config
