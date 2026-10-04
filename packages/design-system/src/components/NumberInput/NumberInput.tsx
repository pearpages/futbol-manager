import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type NumberInputProps = ComponentProps<'input'>

/** A numeric entry box: fees, wages, seats. */
export function NumberInput({ className, ...rest }: NumberInputProps) {
  return <input className={cx('number-input', className)} {...rest} />
}
