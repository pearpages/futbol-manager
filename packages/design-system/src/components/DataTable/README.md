# DataTable

A table of rows on a screen: league tables, squads, listings.

```tsx
import { DataTable } from '@fm/design-system'
```

## Props

| Prop        | Type          |                 |
| ----------- | ------------- | --------------- |
| `className` | `string`      | Extra classes.  |
| `…`         | `table props` | Passed through. |

## Variants

- Rows and cells keep their classes: `data-table__head`, `__row` (`is-you`, `is-clickable`), `__num`, `__band`, `is-text`.

## Do

- Right-align numbers (`data-table__num`), left-align text (`is-text`).
- Mark your club's row with `is-you`.

## Don't

- Don't wrap cells; tables scroll inside their screen.

[preview.html](preview.html) renders it from the bundle.
