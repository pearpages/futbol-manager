# PlayerLink

A player's name as a control: it reads like the text around it and opens his ficha.

```tsx
import { PlayerLink } from '@fm/design-system'
```

## Props

| Prop        | Type         |                   |
| ----------- | ------------ | ----------------- |
| `label`     | `string`     | The name.         |
| `onClick`   | `() => void` | Opens the player. |
| `className` | `string`     | Extra classes.    |

## Do

- Use it wherever a player is named in a table or a sentence.

## Don't

- Don't style it as a button; it inherits the text it sits in.

[preview.html](preview.html) renders it from the bundle.
