import { SCHEMA_VERSION } from '@fm/persistence'
import './App.css'

/** Placeholder shell. Real screens arrive with M3. */
export function App() {
  return (
    <main className="app-shell">
      <h1 className="app-shell__title">Fútbol Manager</h1>
      <p className="app-shell__status">Save format v{SCHEMA_VERSION}</p>
    </main>
  )
}
