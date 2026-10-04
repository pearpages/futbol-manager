# Pager

Previous and next arrows around a label, for paging a list.

```tsx
import { Pager } from '@fm/design-system'
```

## Props

| Prop                    | Type         |                               |
| ----------------------- | ------------ | ----------------------------- |
| `onPrev / onNext`       | `() => void` | Called on each arrow.         |
| `prevLabel / nextLabel` | `string`     | The arrows' accessible names. |
| `atStart / atEnd`       | `boolean`    | Disables an arrow.            |
| `className`             | `string`     | Screen layout.                |
| `children`              | `ReactNode`  | The label between the arrows. |

## Do

- Put the page or the matchday in the middle.

## Don't

- Don't cap a list silently; page it.

[preview.html](preview.html) renders it from the bundle.
