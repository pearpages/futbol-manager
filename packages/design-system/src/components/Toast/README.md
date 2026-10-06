# Toast

A short note that something happened, with an optional undo. Without an action it goes by itself, holding while the pointer or focus is on it. With one it waits for the action or its close button, so nobody runs out of time to reach Undo (WCAG 2.2.1).

```tsx
import { Toast } from '@fm/design-system'
```

## Props

| Prop          | Type         |                                                                 |
| ------------- | ------------ | --------------------------------------------------------------- |
| `message`     | `string`     | What happened, in the past tense.                               |
| `actionLabel` | `string`     | Usually "Desfés".                                               |
| `onAction`    | `() => void` | Runs, then the toast dismisses.                                 |
| `onDismiss`   | `() => void` | Called after `duration`, the action or the close button.        |
| `closeLabel`  | `string`     | Names the × button. Give one whenever there is an action.       |
| `duration`    | `number`     | Milliseconds, 6000 by default. Ignored when there is an action. |

## Do

- Offer undo for what is cheap to reverse, instead of asking first.

- The message is announced through a live region that exists before the text arrives, and focus goes back where it was when the toast leaves.

## Don't

- Don't use it for an error. Errors stay beside the control that caused them.

The caller positions it; on a phone the shell puts it above the action bar.

[preview.html](preview.html) renders it from the bundle.
