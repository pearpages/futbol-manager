import { SCHEMA_VERSION } from '@fm/persistence'
import styles from './App.module.css'

/** Placeholder shell. Real screens arrive with M3. */
export function App() {
  return (
    <main className={styles.shell}>
      <h1 className={styles.title}>Fútbol Manager</h1>
      <p className={styles.status}>Save format v{SCHEMA_VERSION}</p>
    </main>
  )
}
