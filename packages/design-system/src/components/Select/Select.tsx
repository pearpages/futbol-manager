import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type SelectProps = ComponentProps<'select'>

/** A drop-down on a screen. */
export function Select({ className, ...rest }: SelectProps) {
  return <select className={cx('select', className)} {...rest} />
}
