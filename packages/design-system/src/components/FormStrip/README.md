# FormStrip

A club's latest results as coloured squares, oldest first.

```tsx
import { FormStrip } from '@fm/design-system'
```

## Props

| Prop    | Type                              |                                                                                                         |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `label` | `string`                          | The list's accessible name.                                                                             |
| `pips`  | `{ key, outcome, text, mark? }[]` | `outcome` is win, draw, loss or null for not yet played. `mark` is the letter drawn on a played square. |

## Variants

- win, draw, loss, not played.

## Do

- Pad with blanks at the left so the latest result is always rightmost.
- Give every played square its `mark`: three fills are not enough for someone who cannot tell them apart (WCAG 1.4.1).

[preview.html](preview.html) renders it from the bundle.
