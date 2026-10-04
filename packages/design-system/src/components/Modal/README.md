# Modal

A dialog over the current screen: a question, or a table that belongs on top of what you were doing.

```tsx
import { Modal } from '@fm/design-system'
```

## Props

| Prop       | Type         |                                                     |
| ---------- | ------------ | --------------------------------------------------- |
| `title`    | `string`     | The heading, and the dialog's accessible name.      |
| `onClose`  | `() => void` | Escape, the backdrop and the close control call it. |
| `wide`     | `boolean`    | Wide enough for a table.                            |
| `children` | `ReactNode`  | The body.                                           |

## Variants

- Default: a sentence and a pair of buttons.
- `wide`: a table.

## Do

- Return focus to what opened it (it does this itself).

## Don't

- Don't stack dialogs.

[preview.html](preview.html) renders it from the bundle.
