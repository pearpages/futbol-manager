# Fonts

There are none, on purpose. The game ships no web fonts: the project takes no dependency it
can avoid, and the look does not come from a typeface. It comes from treatment — condensed
stacks, tight uppercase tracking, heavy weight contrast and tabular figures wherever a number
appears.

The two families are system stacks, in `src/tokens.json` under `type.families`:

- `font`: `'Helvetica Neue', Helvetica, Arial, sans-serif`
- `font-condensed`: `'Helvetica Neue Condensed', 'Arial Narrow', 'Helvetica Neue', sans-serif`

That is why `type.fonts` is empty. If the game ever adopts a web font, its files go here and
each one is listed in `type.fonts` with its `file`.
