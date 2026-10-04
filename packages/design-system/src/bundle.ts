/**
 * The IIFE entry: everything in `index.ts`, plus React and ReactDOM so a page
 * with no module loader can mount the components. See ADR 0016.
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'

export * from './index.ts'
export { React, createRoot }
