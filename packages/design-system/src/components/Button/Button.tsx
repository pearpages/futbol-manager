import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'
import { Icon } from '../Icon/Icon.tsx'
import type { IconName } from '../Icon/icons.ts'

export type ButtonProps = ComponentProps<'button'> & {
  /** The brass accent: the one action a screen is asking for. */
  readonly primary?: boolean
  /**
   * A glyph before the label, for a verb that recurs across the game. The label
   * always stays: an icon alone is a guess. The glyph is `aria-hidden`, so the
   * button's accessible name is its label exactly as before.
   */
  readonly icon?: IconName | undefined
}

/**
 * A bevelled hardware button. Pass `type` yourself: inside a form the browser
 * default is `submit`, and the wrapper does not guess.
 */
export function Button({ primary = false, icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cx('button', primary && 'is-primary', icon !== undefined && 'has-icon', className)}
      {...rest}
    >
      {icon !== undefined && <Icon name={icon} />}
      {children}
    </button>
  )
}
