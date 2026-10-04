# PitchView

The starting eleven on a pitch, one disc per player with his rating.

```tsx
import { PitchView } from '@fm/design-system'
```

## Props

| Prop       | Type                                      |                      |
| ---------- | ----------------------------------------- | -------------------- |
| `starters` | `{ id, position, name, rating, label }[]` | In lineup order.     |
| `selected` | `string \| null`                          | The picked player.   |
| `onPick`   | `(id) => void`                            | Picks a player.      |
| `title`    | `string`                                  | The accessible name. |

## Do

- Lay out positions with `pitchSlots`.

## Don't

- Don't draw a real club's kit on it.

[preview.html](preview.html) renders it from the bundle.
