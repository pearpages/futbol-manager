# AttributeRadar

An octagon of a player's eight attributes, with an optional second player outlined over it.

```tsx
import { AttributeRadar } from '@fm/design-system'
```

## Props

| Prop      | Type       |                                     |
| --------- | ---------- | ----------------------------------- |
| `values`  | `number[]` | Eight values, 0–100, in axis order. |
| `compare` | `number[]` | A second player's eight values.     |
| `labels`  | `string[]` | Short axis names.                   |
| `title`   | `string`   | The accessible name.                |

## Variants

- Series A is brass, series B is blue (`series-a`, `series-b`).

## Do

- Put the numbers beside it in `AttrBar`s; the chart is the shape, not the figures.

## Don't

- Don't colour it in code.

[preview.html](preview.html) renders it from the bundle.
