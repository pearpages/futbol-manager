import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type SliderProps = ComponentProps<'input'>

/** A range control, styled to the panel. */
export function Slider({ className, ...rest }: SliderProps) {
  return <input className={cx('slider', className)} {...rest} />
}
