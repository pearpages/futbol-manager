# Badge

A club badge that is not a crest: a shape, a shirt pattern and a three-letter code.

```tsx
import { Badge } from '@fm/design-system'
```

## Props

| Prop       | Type                          |                                                                 |
| ---------- | ----------------------------- | --------------------------------------------------------------- |
| `badge`    | `{ colours, pattern, shape }` | One of 18 colour schemes (`COLOUR_KEYS`), 5 patterns, 5 shapes. |
| `code`     | `string`                      | The three letters.                                              |
| `name`     | `string`                      | Tooltip, and the accessible name when `labelled`.               |
| `size`     | `'sm' \| 'lg'`                | Row size or identity size.                                      |
| `labelled` | `boolean`                     | Set when the name is not beside it.                             |

## Variants

- Patterns: solid, stripes, hoops, halves, sash.
- Shapes: shield, circle, square, lozenge, pennant.

## Do

- Render `BadgeDefs` once per page; badges clip to it.

## Don't

- Never draw a real crest (ADR 0007): shape, kit colours and a code only.

[preview.html](preview.html) renders it from the bundle.
