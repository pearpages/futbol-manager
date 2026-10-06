import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type ScreenHeadingProps = ComponentProps<'h2'> & {
  /**
   * A control that belongs beside the heading (an Explain "i"). It sits in the
   * heading's row but outside the `<h2>`, so it never becomes part of the
   * heading's name: inside, a screen reader heard "Squad Explain: …".
   */
  readonly aside?: React.ReactNode
}

/** The heading of a screen block: condensed, uppercase, the panel's title. */
export function ScreenHeading({ className, aside, ...rest }: ScreenHeadingProps) {
  const heading = <h2 className={cx('screen__heading', className)} {...rest} />
  if (aside === undefined) return heading
  return (
    <div className="screen__heading-row">
      {heading}
      {aside}
    </div>
  )
}
