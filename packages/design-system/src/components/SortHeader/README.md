# SortHeader

A sortable column header: click to sort, again to reverse, a third time to clear.

```tsx
import { SortHeader } from '@fm/design-system'
```

## Props

| Prop        | Type              |                                                                            |
| ----------- | ----------------- | -------------------------------------------------------------------------- |
| `column`    | `K`               | The column key.                                                            |
| `label`     | `string`          | The header text.                                                           |
| `fullLabel` | `string`          | The words behind an abbreviated label ("Won" for "W"), read instead of it. |
| `sort`      | `Sort<K> \| null` | The current sort.                                                          |
| `onSort`    | `(next) => void`  | Receives the next sort.                                                    |
| `align`     | `string`          | `is-text` for a left-aligned column.                                       |

## Do

- Pair it with `sortedBy` from the same module.

[preview.html](preview.html) renders it from the bundle.
