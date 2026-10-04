import type { ComponentProps } from 'react'
import { cx } from '../../cx.ts'

export type DataTableProps = ComponentProps<'table'>

/** A table of rows on a screen: league tables, squads, listings. Rows and cells keep their `data-table__*` classes. */
export function DataTable({ className, ...rest }: DataTableProps) {
  return <table className={cx('data-table', className)} {...rest} />
}
