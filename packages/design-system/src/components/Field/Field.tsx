import { type ComponentProps, createElement, type JSX } from 'react'
import { cx } from '../../cx.ts'

export type FieldProps = ComponentProps<'label'> & {
  /** The element to render. `div` unless the markup needs another. */
  readonly as?: 'div' | 'label'
}

/** A label and its control, stacked. */
export function Field({ as = 'div', className, ...rest }: FieldProps): JSX.Element {
  return createElement(as, { className: cx('field', className), ...rest })
}
