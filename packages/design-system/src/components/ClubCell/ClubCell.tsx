import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type ClubCellProps = ComponentProps<'span'>

/** A club's badge and name side by side in a table cell. */
export function ClubCell({ className, ...rest }: ClubCellProps) {
  return <span className={cx('club-cell', className)} {...rest} />
}
