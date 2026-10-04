import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type HintProps = ComponentProps<'p'>

/** A small line of help under a control or a block. */
export function Hint({ className, ...rest }: HintProps) {
  return <p className={cx('hint', className)} {...rest} />
}
