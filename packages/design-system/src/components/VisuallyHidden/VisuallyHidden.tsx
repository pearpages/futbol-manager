import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type VisuallyHiddenProps = ComponentProps<'span'>

/** Text for screen readers only. Mind the leading space when it sits inside other text. */
export function VisuallyHidden({ className, ...rest }: VisuallyHiddenProps) {
  return <span className={cx('visually-hidden', className)} {...rest} />
}
