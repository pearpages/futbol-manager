import type { Meta, StoryObj } from '@storybook/react-vite'
import { App } from '../App.tsx'
import type { Language } from '../i18n/index.ts'
import { type Scene, stage } from './stage.ts'

/**
 * Every screen of the game, rendered by the real `App` from a real career.
 *
 * Switch the viewport in the toolbar to see each one at phone, tablet and
 * desktop width, and the language to check the longest labels. The scene in
 * each story's parameters says where the career is.
 */
const meta = {
  title: 'Screens',
  component: App,
  beforeEach({ parameters, globals }) {
    stage(parameters['scene'] as Scene, (globals['language'] ?? 'ca') as Language)
  },
} satisfies Meta<typeof App>

export default meta
type Story = StoryObj<typeof meta>

const at = (scene: Scene): Story => ({ parameters: { scene } })

export const Landing = at({ screen: 'landing' })
export const Setup = at({ screen: 'setup' })
export const HubFirstDay = at({ screen: 'hub' })
export const Hub = at({ screen: 'hub', days: 10 })
export const Table = at({ screen: 'table', days: 10 })
export const Results = at({ screen: 'results', days: 10 })
export const Calendar = at({ screen: 'calendar', days: 10 })
export const Lineup = at({ screen: 'lineup', days: 10 })
export const Market = at({ screen: 'market', days: 10 })
export const MarketClubs = at({ screen: 'market', days: 10, marketTab: 'clubs' })
export const Squad = at({ screen: 'squad', days: 10 })
export const Player = at({ screen: 'player', days: 10 })
export const Caja = at({ screen: 'caja', days: 10 })
export const Decisiones = at({ screen: 'decisiones', days: 10 })
export const Estadio = at({ screen: 'estadio', days: 10 })
/** Late in the season, with the window shut and most results in. */
export const HubLateSeason = at({ screen: 'hub', days: 200 })
