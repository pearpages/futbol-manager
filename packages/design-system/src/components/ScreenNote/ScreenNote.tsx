import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type ScreenNoteProps = ComponentProps<'p'>

/** A sentence of explanation inside a screen, in the soft screen ink. */
export function ScreenNote({ className, ...rest }: ScreenNoteProps) {
  return <p className={cx('screen__note', className)} {...rest} />
}
