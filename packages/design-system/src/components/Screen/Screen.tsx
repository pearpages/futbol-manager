import { type ComponentProps, createElement, type JSX } from 'react'
import { cx } from '../../cx.ts'

export type ScreenProps = ComponentProps<'section'> & {
  /** The element to render. `section` unless the markup needs another. */
  readonly as?: 'section' | 'div'
}

/** A recessed display that holds data: every table, list and figure in the game sits in one. */
export function Screen({ as = 'section', className, ...rest }: ScreenProps): JSX.Element {
  return createElement(as, { className: cx('screen', className), ...rest })
}
