import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Order matters for readability: tokens define the custom properties the reset and
// the chrome consume.
import '@fm/design-system/tokens.css'
import '@fm/design-system/reset.css'
import '@fm/design-system/chrome.css'
import { App } from './App.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
