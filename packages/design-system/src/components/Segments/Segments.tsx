import { cx } from '../../cx.ts'
import { Button } from '../Button/Button.tsx'
import './Segments.css'

export interface SegmentOption<T extends string> {
  readonly value: T
  readonly label: string
}

/**
 * Sibling views of one thing, one lit: the results' three tabs, the market's two,
 * and on a phone the screens a tab holds.
 *
 * Buttons with `aria-pressed`, not a `tablist` — a tablist owes arrow-key
 * navigation, and buttons are keyboard-reachable for nothing (the reasoning the
 * Results screen first wrote down).
 */
export function Segments<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** The group's accessible name. */
  readonly label: string
  readonly options: readonly SegmentOption<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
  readonly className?: string
}): React.JSX.Element {
  return (
    <div className={cx('segments', className)} role="group" aria-label={label}>
      {options.map((option) => (
        <Button
          primary={option.value === value}
          key={option.value}
          type="button"
          className="segments__option"
          aria-pressed={option.value === value}
          onClick={() => {
            onChange(option.value)
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
