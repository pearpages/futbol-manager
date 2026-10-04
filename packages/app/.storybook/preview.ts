import type { Preview } from '@storybook/react-vite'
// The same three global stylesheets, in the same order, as `main.tsx`.
import '@fm/design-system/tokens.css'
import '@fm/design-system/reset.css'
import '@fm/design-system/chrome.css'
import './preview.css'

/** The widths the game is laid out for. ADR 0018 says why these three. */
const VIEWPORTS = {
  phone: { name: 'Phone 390', styles: { width: '390px', height: '844px' }, type: 'mobile' },
  tablet: { name: 'Tablet 768', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
  desktop: { name: 'Desktop 1280', styles: { width: '1280px', height: '800px' }, type: 'desktop' },
} as const

const preview: Preview = {
  globalTypes: {
    language: {
      description: 'The language the game speaks',
      toolbar: {
        title: 'Language',
        items: [
          { value: 'ca', title: 'Català' },
          { value: 'es', title: 'Español' },
          { value: 'en', title: 'English' },
        ],
      },
    },
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { options: VIEWPORTS },
  },
  initialGlobals: { viewport: { value: 'phone', isRotated: false }, language: 'ca' },
}

export default preview
