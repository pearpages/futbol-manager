/**
 * The IIFE entry: everything in `index.ts`, plus React and ReactDOM so a page
 * with no module loader can mount the components. See ADR 0016.
 *
 * The three global stylesheets come first, in the order the app loads them, so
 * `bundle.css` is the whole look: tokens, reset, chrome, then each component.
 */
import './tokens.css'
import './styles/reset.css'
import './styles/chrome.css'
import * as React from 'react'
import { createRoot } from 'react-dom/client'

export * from './index.ts'
export { React, createRoot }
