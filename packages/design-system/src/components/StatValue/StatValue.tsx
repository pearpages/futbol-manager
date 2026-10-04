import { type ComponentProps, createElement } from 'react'
import { cx } from '../../cx.ts'

export type StatValueProps = ComponentProps<'span'> & {
  /** The element to render. `span` unless the markup needs another. */
  readonly as?: 'span' | 'dd'
}

/** The figure of a stat, in tabular numerals. */
export function StatValue({ as = 'span', className, ...rest }: StatValueProps) {
  return createElement(as, { className: cx('stat__value', className), ...rest })
}
