# TrophyIcon

A trophy on the palmarés, dimmed when nobody has won it yet.

```tsx
import { TrophyIcon } from '@fm/design-system'
```

## Props

| Prop     | Type      |                                       |
| -------- | --------- | ------------------------------------- |
| `trophy` | `string`  | Which competition, for `data-trophy`. |
| `src`    | `string`  | The cut-out image.                    |
| `empty`  | `boolean` | Dims it.                              |

## Variants

- Won, or `empty`.

## Do

- Show every competition from day one, dimmed until won.

## Don't

- Don't draw a real competition's trophy (ADR 0007).

[preview.html](preview.html) renders it from the bundle.
