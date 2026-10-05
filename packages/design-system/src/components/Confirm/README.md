# Confirm

A question before something that cannot be taken back, saying in numbers what will
happen.

```tsx
import { Confirm } from '@fm/design-system'
```

## Props

| Prop           | Type         |                                             |
| -------------- | ------------ | ------------------------------------------- |
| `title`        | `string`     | The question, naming the thing.             |
| `children`     | `ReactNode`  | What happens: fee, what is left, and so on. |
| `confirmLabel` | `string`     | The verb.                                   |
| `confirmIcon`  | `IconName`   | The glyph of the button that opened it.     |
| `cancelLabel`  | `string`     | The way out.                                |
| `onConfirm`    | `() => void` |                                             |
| `onCancel`     | `() => void` | Also Escape and a click on the backdrop.    |

## Do

- Use it only for what has no undo: money spent, a player sold, a career started.
- Say what is left afterwards, not just what it costs.

## Don't

- Don't confirm what can be undone. Offer undo instead (`Toast`).

[preview.html](preview.html) renders it from the bundle.
