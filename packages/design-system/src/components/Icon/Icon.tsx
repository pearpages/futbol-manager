import { cx } from '../../cx.ts'
import { ICON_PATHS, type IconName } from './icons.ts'
import './Icon.css'

/**
 * One interface glyph. Always `aria-hidden`: the button or link it sits in
 * carries the name, so an icon never changes what a control is called.
 */
export function Icon({
  name,
  className,
}: {
  readonly name: IconName
  readonly className?: string
}): React.JSX.Element {
  return (
    <svg className={cx('icon', className)} viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICON_PATHS[name]} fillRule="evenodd" />
    </svg>
  )
}
