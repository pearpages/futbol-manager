import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type StatProps = ComponentProps<'div'>

/** A labelled figure: a small label over a large number. */
export function Stat({ className, ...rest }: StatProps) {
  return <div className={cx('stat', className)} {...rest} />
}
