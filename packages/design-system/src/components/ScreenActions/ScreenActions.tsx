import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type ScreenActionsProps = ComponentProps<'div'>

/** A row of buttons at the foot of a screen block. */
export function ScreenActions({ className, ...rest }: ScreenActionsProps) {
  return <div className={cx('screen-actions', className)} {...rest} />
}
