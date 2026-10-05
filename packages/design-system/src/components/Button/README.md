# Button

A bevelled hardware button, condensed and uppercase.

```tsx
import { Button } from '@fm/design-system'
```

## Props

| Prop      | Type                   |                                                                    |
| --------- | ---------------------- | ------------------------------------------------------------------ |
| `primary` | `boolean`              | The brass accent: the one action the screen is asking for.         |
| `icon`    | `IconName`             | A glyph before the label, for a verb that recurs. The label stays. |
| `type`    | `'button' \| 'submit'` | Always pass it: the wrapper does not guess.                        |
| `…`       | `button props`         | Passed through.                                                    |

## Variants

- Default: panel face.
- `primary`: brass, for the action the screen wants.
- Disabled: faded ink, no hover.

## Do

- One primary per view.
- Label with a verb.

## Don't

- Don't use a button as a link to another site.
- Don't make two primaries side by side.

[preview.html](preview.html) renders it from the bundle.
