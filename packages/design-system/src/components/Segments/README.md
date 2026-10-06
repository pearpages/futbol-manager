# Segments

Sibling views of one thing, with the current one lit.

```tsx
import { Segments } from '@fm/design-system'
```

## Props

| Prop       | Type                               |                                                               |
| ---------- | ---------------------------------- | ------------------------------------------------------------- |
| `label`    | `string`                           | The group's accessible name.                                  |
| `options`  | `{ value, label, icon?, lang? }[]` | In reading order. `lang` when a label is in another language. |
| `value`    | `string`                           | The current one.                                              |
| `onChange` | `(value) => void`                  |                                                               |

## Do

- Keep it to two to four options. On a phone they share the width equally.

## Don't

- Don't use it for an action. Every option is a place, not a verb.

[preview.html](preview.html) renders it from the bundle.
