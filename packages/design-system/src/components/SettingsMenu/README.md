# SettingsMenu

The language in use, shown as its code (CA ▾), opening a menu of languages.

```tsx
import { SettingsMenu } from '@fm/design-system'
```

## Props

| Prop            | Type                |                                             |
| --------------- | ------------------- | ------------------------------------------- |
| `languageLabel` | `string`            | The menu heading; also read after the code. |
| `languages`     | `{ value, name }[]` | Each language, named in itself.             |
| `current`       | `string`            | The one in use.                             |
| `onChange`      | `(value) => void`   | Picks one.                                  |

## Do

- Name each language in itself: Català, Español, English.

## Don't

- Put it back behind an icon. A code reads in any language; an 18px cog did not.

[preview.html](preview.html) renders it from the bundle.
