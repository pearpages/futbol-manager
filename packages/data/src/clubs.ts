import type { Club, ClubId } from '@fm/domain'

/**
 * The default fictional league — twenty invented clubs in a Spanish idiom.
 *
 * Content lives in `data`, never in `domain`. Real club names stay a user-supplied
 * import, per the roadmap: the game ships fictional by default.
 *
 * Ordering is the canonical one; it seeds fixture generation, so changing it
 * changes every generated season for a given seed.
 */
/**
 * `[id, name, shortName, attack, defence]`.
 *
 * Ratings are **provisional and M2-only** — they stand in for squads until players
 * exist at M3, where the rating is derived from the selected XI instead.
 *
 * The shape of the spread is what makes a league feel like a league, and it is the
 * main lever on the champion-points band in the harness. Real top divisions are
 * top-heavy rather than evenly graded: two or three clubs clear of the rest, a
 * broad middle where a few rating points separate seventh from fourteenth, and a
 * weak tail. A uniform ramp from 40 to 90 produces a tidy, lifeless table.
 */
const CLUBS: readonly (readonly [string, string, string, number, number])[] = [
  // Contenders
  ['montjuic', 'Montjuïc Barcelona', 'MON', 88, 85],
  ['hispalis', 'Hispalis Sevilla', 'HIS', 86, 82],
  ['atletico-nervion', 'Atlético Nervión', 'ANV', 80, 86],
  // European places
  ['ebro', 'Ebro Zaragoza', 'EBR', 76, 74],
  ['real-tajo', 'Real Tajo Toledo', 'RTA', 73, 72],
  ['cantera', 'Cantera Bilbaína', 'CAN', 70, 74],
  // The broad middle — a few points apart, so finishing order here is mostly form
  ['duero', 'Duero Valladolid', 'DUE', 68, 66],
  ['guadalquivir', 'Guadalquivir CF', 'GUA', 66, 67],
  ['tramontana', 'Tramontana Girona', 'TRA', 67, 64],
  ['almirante', 'Almirante Cádiz', 'ALM', 65, 65],
  ['costa-verde', 'Costa Verde CF', 'CVE', 64, 66],
  ['numancia-real', 'Real Numancia', 'NUM', 63, 64],
  ['bahia', 'Bahía Sotogrande', 'BAH', 65, 61],
  ['sierra', 'Sierra Granada', 'SIE', 61, 63],
  // Strugglers
  ['calatrava', 'CD Calatrava', 'CAL', 59, 60],
  ['levante-mar', 'Levante del Mar', 'LMA', 58, 58],
  ['union-astur', 'Unión Astur', 'UAS', 57, 56],
  // The tail
  ['aguilas', 'Águilas de Marbella', 'AGU', 54, 53],
  ['pinares', 'Pinares Soria', 'PIN', 52, 51],
  ['gaviotas', 'Gaviotas de Vigo', 'GAV', 49, 50],
]

export const DEFAULT_CLUBS: readonly Club[] = CLUBS.map(
  ([id, name, shortName, attack, defence]) => ({
    id: id as ClubId,
    name,
    shortName,
    attack,
    defence,
  }),
)
