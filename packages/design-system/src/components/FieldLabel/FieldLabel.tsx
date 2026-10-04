import { type ComponentProps, createElement, type JSX } from 'react'
import { cx } from '../../cx.ts'

export type FieldLabelProps = ComponentProps<'label'> & {
  /** The element to render. `label` unless the markup needs another. */
  readonly as?: 'label' | 'span'
}

/** The small uppercase label of a field. */
export function FieldLabel({ as = 'label', className, ...rest }: FieldLabelProps): JSX.Element {
  return createElement(as, { className: cx('field__label', className), ...rest })
}
