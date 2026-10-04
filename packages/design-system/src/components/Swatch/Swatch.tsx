import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type SwatchProps = ComponentProps<'span'>

/** A square of a position band's colour, for a table's key. */
export function Swatch({ className, ...rest }: SwatchProps) {
  return <span className={cx('swatch', className)} {...rest} />
}
