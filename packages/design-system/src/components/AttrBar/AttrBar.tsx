import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type AttrBarProps = ComponentProps<'div'>

/** An attribute row: label, a bar filled in twentieths, and the value. Children keep their `attr__*` classes. */
export function AttrBar({ className, ...rest }: AttrBarProps) {
  return <div className={cx('attr', className)} {...rest} />
}
