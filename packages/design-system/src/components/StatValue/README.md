# StatValue

The figure of a stat, large and in tabular numerals.

```tsx
import { StatValue } from '@fm/design-system'
```

## Props

| Prop        | Type             |                                                          |
| ----------- | ---------------- | -------------------------------------------------------- |
| `as`        | `'span' \| 'dd'` | Element. Default `span`; `dd` inside a description list. |
| `className` | `string`         | A band class colours it.                                 |
| `…`         | `span props`     | Passed through.                                          |

## Do

- Format numbers in the app, with the player's locale.

[preview.html](preview.html) renders it from the bundle.
