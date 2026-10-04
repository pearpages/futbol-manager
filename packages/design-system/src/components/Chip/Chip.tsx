import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type ChipProps = ComponentProps<'span'>

/** A small position tag (POR, DEF, MIG, DAV); the tone comes from an `is-gk|df|mf|fw` class. */
export function Chip({ className, ...rest }: ChipProps) {
  return <span className={cx('chip', className)} {...rest} />
}
