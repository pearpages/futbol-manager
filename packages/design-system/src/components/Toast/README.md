# Toast

A short note that something happened, with an optional undo. It goes by itself.

```tsx
import { Toast } from '@fm/design-system'
```

## Props

| Prop          | Type         |                                              |
| ------------- | ------------ | -------------------------------------------- |
| `message`     | `string`     | What happened, in the past tense.            |
| `actionLabel` | `string`     | Usually "Desfés".                            |
| `onAction`    | `() => void` | Runs, then the toast dismisses.              |
| `onDismiss`   | `() => void` | Called after `duration` or after the action. |
| `duration`    | `number`     | Milliseconds, 6000 by default.               |

## Do

- Offer undo for what is cheap to reverse, instead of asking first.

## Don't

- Don't use it for an error. Errors stay beside the control that caused them.

The caller positions it; on a phone the shell puts it above the action bar.

[preview.html](preview.html) renders it from the bundle.
