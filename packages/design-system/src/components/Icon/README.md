# Icon

An interface glyph: navigation and actions. The hub's tile pictures are `TileIcon`.

```tsx
import { Icon } from '@fm/design-system'
;<Button type="button" aria-label="Desa">
  <Icon name="save" />
</Button>
```

## Props

| Prop        | Type       |                      |
| ----------- | ---------- | -------------------- |
| `name`      | `IconName` | One of `ICON_NAMES`. |
| `className` | `string`   | Extra classes.       |

## Glyphs

`home` `shirt` `transfer` `league` `club` `more` `back` `play` `skip` `save` `filter`
`search` `close` `undo` `check` `chevron`. Geometry lives in `icons.ts`, one path on a
24-unit grid; colour is `currentColor` (P17).

## Do

- Put the name on the control that holds it, never on the icon.
- Pair it with a word wherever there is room. On the tab bar there always is.

## Don't

- Don't colour a glyph in TS. Set `color` on its parent.

[preview.html](preview.html) renders it from the bundle.
