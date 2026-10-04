# TileIcon

The hub's 18px tile icons, drawn in code and inked with the tile's colour.

```tsx
import { TileIcon } from '@fm/design-system'
```

## Props

| Prop   | Type      |                     |
| ------ | --------- | ------------------- |
| `icon` | `IconKey` | One of `ICON_KEYS`. |

## Variants

- table, results, calendar, pitch, training, scout, contract, roster, youth, safe, scales, stadium.

## Do

- Put it before the tile's label; it is `aria-hidden`.

## Don't

- Don't add text to it: it would rename the tile.

[preview.html](preview.html) renders it from the bundle.
