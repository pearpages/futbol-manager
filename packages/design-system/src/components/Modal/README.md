# Modal

A dialog over the current screen: a question, or a table that belongs on top of what you were doing.

```tsx
import { Modal } from '@fm/design-system'
```

## Props

| Prop         | Type         |                                                                       |
| ------------ | ------------ | --------------------------------------------------------------------- |
| `title`      | `string`     | The heading, and the dialog's accessible name.                        |
| `onClose`    | `() => void` | Escape, the backdrop and the close control call it.                   |
| `wide`       | `boolean`    | Wide enough for a table.                                              |
| `full`       | `boolean`    | On a phone, the whole screen instead of a sheet: for lists and forms. |
| `closeLabel` | `string`     | Names the × a full-screen dialog shows on a phone.                    |
| `children`   | `ReactNode`  | The body.                                                             |

## Variants

- Default: a sentence and a pair of buttons.
- `wide`: a table.
- `full`: a list or a form (saves, news, an explanation, a bid). On a phone it fills the
  screen with a × in its heading; a plain dialog rises from the bottom as a sheet.

While any dialog is open the page behind it does not scroll. Dialogs render into
`document.body`, so no stacking context in the page can draw over them.

## Do

- Return focus to what opened it (it does this itself).

## Don't

- Don't stack dialogs.

[preview.html](preview.html) renders it from the bundle.
