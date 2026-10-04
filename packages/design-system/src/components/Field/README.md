# Field

A label and its control, stacked.

```tsx
import { Field } from '@fm/design-system'
```

## Props

| Prop        | Type               |                                                                   |
| ----------- | ------------------ | ----------------------------------------------------------------- |
| `as`        | `'div' \| 'label'` | Element. Default `div`; `label` when the label wraps the control. |
| `className` | `string`           | Extra classes.                                                    |
| `…`         | `label props`      | Passed through.                                                   |

## Do

- Pair a `FieldLabel` with one control.

## Don't

- Don't put two controls in one field.

[preview.html](preview.html) renders it from the bundle.
