# AttrBar

An attribute row: label, a bar filled in twentieths, and the value.

```tsx
import { AttrBar } from '@fm/design-system'
```

## Props

| Prop        | Type        |                                             |
| ----------- | ----------- | ------------------------------------------- |
| `className` | `string`    | `is-compare` when a second player is shown. |
| `…`         | `div props` | Passed through.                             |

## Variants

- Children keep their classes: `attr__label`, `attr__track`, `attr__fill` (with `data-fill` 0–20), `attr__value`.

## Do

- Bucket the fill with `data-fill`; never a style prop.

## Don't

- Don't set a width inline.

[preview.html](preview.html) renders it from the bundle.
