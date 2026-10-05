import { Panel } from '../components/Panel/Panel.tsx'
import { Screen } from '../components/Screen/Screen.tsx'
import '../preview.css'

/**
 * Where a story puts its component: on the surface it is drawn for. Screen
 * material is for readouts (tables, notes, fields), the panel for hardware
 * (buttons, menus, the shell's bars). A component shown on the wrong one looks
 * broken — that is how most of the contrast defects started (ADR 0021).
 */
export function OnScreen({
  children,
  row = false,
}: {
  readonly children: React.ReactNode
  /** Variants side by side rather than stacked. */
  readonly row?: boolean
}) {
  return (
    <main className="preview">
      <Screen className={row ? 'preview-row' : 'preview-block'}>{children}</Screen>
    </main>
  )
}

export function OnPanel({
  children,
  row = true,
}: {
  readonly children: React.ReactNode
  readonly row?: boolean
}) {
  return (
    <main className="preview">
      <Panel className={row ? 'preview-row' : 'preview-block'}>{children}</Panel>
    </main>
  )
}

/** Straight on the page, for a component that brings its own surface (a dialog). */
export function OnPage({ children }: { readonly children: React.ReactNode }) {
  return <main className="preview">{children}</main>
}
