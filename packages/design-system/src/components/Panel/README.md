# Panel

Raised hardware: a bevelled panel face that holds controls.

```tsx
import { Panel } from '@fm/design-system'
```

## Props

| Prop        | Type                            |                                   |
| ----------- | ------------------------------- | --------------------------------- |
| `as`        | `'div' \| 'header' \| 'footer'` | Element to render. Default `div`. |
| `className` | `string`                        | Layout classes of the caller.     |
| `…`         | `div props`                     | Passed through.                   |

## Variants

- Lit on the top-left edge, shadowed on the bottom-right: the raised bevel.

## Do

- Use it for anything you press or that holds controls: the shell bar, the footer, menus, dialog boxes.

## Don't

- Don't put data in a panel. Data lives on a `Screen`.
- Don't add a shadow: hardware is bevelled, not floating.

[preview.html](preview.html) renders it from the bundle.
