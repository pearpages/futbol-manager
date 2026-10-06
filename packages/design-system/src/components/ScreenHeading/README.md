# ScreenHeading

The heading of a screen block: condensed, uppercase, bold.

```tsx
import { ScreenHeading } from '@fm/design-system'
```

## Props

| Prop        | Type       |                                                                  |
| ----------- | ---------- | ---------------------------------------------------------------- |
| `className` | `string`   | Extra classes.                                                   |
| `aside`     | `node`     | A control beside the heading (an Explain), kept out of its name. |
| `…`         | `h2 props` | Passed through.                                                  |

## Do

- One per screen block, first child.
- Put an Explain in `aside`, never among the children: Chrome reads a button inside a heading into the heading's name.

## Don't

- Don't use it on a panel.

[preview.html](preview.html) renders it from the bundle.
