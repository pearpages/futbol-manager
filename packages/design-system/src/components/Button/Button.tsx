import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type ButtonProps = ComponentProps<'button'> & {
  /** The brass accent: the one action a screen is asking for. */
  readonly primary?: boolean
}

/**
 * A bevelled hardware button. Pass `type` yourself: inside a form the browser
 * default is `submit`, and the wrapper does not guess.
 */
export function Button({ primary = false, className, ...rest }: ButtonProps) {
  return <button className={cx('button', primary && 'is-primary', className)} {...rest} />
}
