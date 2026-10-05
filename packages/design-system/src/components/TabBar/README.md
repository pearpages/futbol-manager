# TabBar

The phone's way around the game: a few places, each an icon with its word, at the
bottom of the screen.

```tsx
import { TabBar } from '@fm/design-system'
```

## Props

| Prop       | Type                                            |                                   |
| ---------- | ----------------------------------------------- | --------------------------------- |
| `label`    | `string`                                        | The navigation's accessible name. |
| `items`    | `{ value, label, icon, badge?, badgeLabel? }[]` | Four or five.                     |
| `value`    | `string \| null`                                | The current place, if any.        |
| `onChange` | `(value) => void`                               |                                   |

## Do

- Always show the word under the icon.
- Use the badge for things waiting on you, such as offers to answer.

## Don't

- Don't put an action in it. Actions go in the action bar above it.

[preview.html](preview.html) renders it from the bundle.
