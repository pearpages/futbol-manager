# FormStrip

A club's latest results as coloured squares, oldest first.

```tsx
import { FormStrip } from '@fm/design-system'
```

## Props

| Prop    | Type                       |                                                          |
| ------- | -------------------------- | -------------------------------------------------------- |
| `label` | `string`                   | The list's accessible name.                              |
| `pips`  | `{ key, outcome, text }[]` | `outcome` is win, draw, loss or null for not yet played. |

## Variants

- win, draw, loss, not played.

## Do

- Pad with blanks at the left so the latest result is always rightmost.

[preview.html](preview.html) renders it from the bundle.
