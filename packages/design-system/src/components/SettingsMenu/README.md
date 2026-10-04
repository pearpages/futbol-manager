# SettingsMenu

The cog, opening a menu of languages.

```tsx
import { SettingsMenu } from '@fm/design-system'
```

## Props

| Prop            | Type                |                                 |
| --------------- | ------------------- | ------------------------------- |
| `label`         | `string`            | The cog's accessible name.      |
| `languageLabel` | `string`            | The menu heading.               |
| `languages`     | `{ value, name }[]` | Each language, named in itself. |
| `current`       | `string`            | The one in use.                 |
| `onChange`      | `(value) => void`   | Picks one.                      |

## Do

- Name each language in itself: Català, Español, English.

[preview.html](preview.html) renders it from the bundle.
