# Screen

A recessed display where data lives: every table, list and figure sits on one.

```tsx
import { Screen } from '@fm/design-system'
```

## Props

| Prop        | Type                 |                                       |
| ----------- | -------------------- | ------------------------------------- |
| `as`        | `'section' \| 'div'` | Element to render. Default `section`. |
| `className` | `string`             | The screen block's own class.         |
| `…`         | `section props`      | Passed through, `ref` included.       |

## Variants

- Deep pitch-green, sunk with an inverted bevel, so numbers read as illuminated.

## Do

- Give each block a `ScreenHeading`.
- Scroll inside the screen, not the page: it has `overflow: auto`.

## Don't

- Don't put a button bar directly on a screen's edge; use `ScreenActions`.
- Don't nest screens.

[preview.html](preview.html) renders it from the bundle.
