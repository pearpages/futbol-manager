import { type ComponentProps, createElement, type JSX } from 'react'
import { cx } from '../../cx.ts'

export type StatLabelProps = ComponentProps<'span'> & {
  /** The element to render. `span` unless the markup needs another. */
  readonly as?: 'span' | 'dt'
}

/** The label of a stat. */
export function StatLabel({ as = 'span', className, ...rest }: StatLabelProps): JSX.Element {
  return createElement(as, { className: cx('stat__label', className), ...rest })
}
