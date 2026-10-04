import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type ScreenHeadingProps = ComponentProps<'h2'>

/** The heading of a screen block: condensed, uppercase, the panel's title. */
export function ScreenHeading({ className, ...rest }: ScreenHeadingProps) {
  return <h2 className={cx('screen__heading', className)} {...rest} />
}
