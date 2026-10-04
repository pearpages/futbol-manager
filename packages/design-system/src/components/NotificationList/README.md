# NotificationList

The news feed: one line per event, toned good, bad or plain.

```tsx
import { NotificationList } from '@fm/design-system'
```

## Props

| Prop      | Type                    |                                    |
| --------- | ----------------------- | ---------------------------------- |
| `notices` | `{ key, tone, text }[]` | Newest first.                      |
| `empty`   | `string`                | What to say when there is no news. |

## Variants

- Tones: `good`, `bad`, `plain`; colour is never the only signal.

## Do

- Write each line as a whole sentence.

[preview.html](preview.html) renders it from the bundle.
