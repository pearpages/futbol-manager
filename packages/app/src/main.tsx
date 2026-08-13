import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Order matters for readability: tokens define the custom properties the reset and
// the chrome consume.
import './styles/tokens.css'
import './styles/reset.css'
import './styles/chrome.css'
import { App } from './App.js'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
