import { cx } from '../../cx.ts'
import { Icon } from '../Icon/Icon.tsx'
import type { IconName } from '../Icon/icons.ts'
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden.tsx'
import './TabBar.css'

export interface TabItem<T extends string> {
  readonly value: T
  readonly label: string
  readonly icon: IconName
  /** A count waiting there, such as offers to answer. Zero shows nothing. */
  readonly badge?: number
  /** Read after the label by a screen reader, so the count has a meaning ("3 new"). */
  readonly badgeLabel?: string
}

/**
 * The phone's way around the game: a handful of places, always at the bottom
 * where the thumb is. Each is an icon with its word under it — an icon alone is a
 * guess, and the language button already taught that lesson once.
 */
export function TabBar<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: {
  readonly label: string
  readonly items: readonly TabItem<T>[]
  /** The current place, or null when none is (a page outside every tab). */
  readonly value: T | null
  readonly onChange: (value: T) => void
  readonly className?: string
}): React.JSX.Element {
  return (
    <nav className={cx('tab-bar', className)} aria-label={label}>
      {items.map((item) => {
        const current = item.value === value
        const badge = item.badge ?? 0
        return (
          <button
            key={item.value}
            type="button"
            className={cx('tab-bar__item', current && 'is-current')}
            aria-current={current ? 'page' : undefined}
            onClick={() => {
              onChange(item.value)
            }}
          >
            <Icon name={item.icon} className="tab-bar__icon" />
            <span className="tab-bar__label">{item.label}</span>
            {/* Spaces as their own text nodes: a space inside a span is dropped from
                the accessible name, which then reads "Market2". */}
            {badge > 0 && (
              <>
                {' '}
                <span className="tab-bar__badge">
                  {badge}
                  {item.badgeLabel !== undefined && (
                    <>
                      {' '}
                      <VisuallyHidden>{item.badgeLabel}</VisuallyHidden>
                    </>
                  )}
                </span>
              </>
            )}
          </button>
        )
      })}
    </nav>
  )
}
