import { StadiumView as StadiumViewDrawing } from '@fm/design-system'
import { seatsKey, type StadiumArt } from './stadium.ts'

/** The club's ground, picked by capacity: the design system's drawing at this rung. */
export function StadiumView({ art }: { readonly art: StadiumArt }) {
  return <StadiumViewDrawing src={`/art/stadium/${art.file}.webp`} seats={seatsKey(art.seats)} />
}
