# Explain

The small "i" beside a figure, opening a dialog that explains it.

```tsx
import { Explain } from '@fm/design-system'
```

## Props

| Prop         | Type       |                               |
| ------------ | ---------- | ----------------------------- |
| `label`      | `string`   | The button's accessible name. |
| `title`      | `string`   | The dialog title.             |
| `paragraphs` | `string[]` | The explanation.              |
| `closeLabel` | `string`   | The close button.             |

## Do

- Put it beside the heading of the block it explains, through `ScreenHeading`'s `aside`. Inside the `<h2>`, Chrome reads its label as part of the heading.

## Don't

- Don't use it for anything a player must read to play; say it on the screen.

[preview.html](preview.html) renders it from the bundle.
