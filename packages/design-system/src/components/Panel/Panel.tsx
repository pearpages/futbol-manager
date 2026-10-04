import { type ComponentProps, createElement } from 'react'
import { cx } from '../../cx.ts'

export type PanelProps = ComponentProps<'div'> & {
  /** The element to render. `div` unless the markup needs another. */
  readonly as?: 'div' | 'header' | 'footer'
}

/** Raised hardware: a bevelled face that holds controls — the shell bar, the footer, a menu, a dialog box. */
export function Panel({ as = 'div', className, ...rest }: PanelProps) {
  return createElement(as, { className: cx('panel', className), ...rest })
}
