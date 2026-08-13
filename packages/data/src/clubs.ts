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
const CLUBS: readonly (readonly [string, string, string])[] = [
  ['aguilas', 'Águilas de Marbella', 'AGU'],
  ['almirante', 'Almirante Cádiz', 'ALM'],
  ['atletico-nervion', 'Atlético Nervión', 'ANV'],
  ['bahia', 'Bahía Sotogrande', 'BAH'],
  ['calatrava', 'CD Calatrava', 'CAL'],
  ['cantera', 'Cantera Bilbaína', 'CAN'],
  ['costa-verde', 'Costa Verde CF', 'CVE'],
  ['duero', 'Duero Valladolid', 'DUE'],
  ['ebro', 'Ebro Zaragoza', 'EBR'],
  ['gaviotas', 'Gaviotas de Vigo', 'GAV'],
  ['guadalquivir', 'Guadalquivir CF', 'GUA'],
  ['hispalis', 'Hispalis Sevilla', 'HIS'],
  ['levante-mar', 'Levante del Mar', 'LMA'],
  ['montjuic', 'Montjuïc Barcelona', 'MON'],
  ['numancia-real', 'Real Numancia', 'NUM'],
  ['pinares', 'Pinares Soria', 'PIN'],
  ['real-tajo', 'Real Tajo Toledo', 'RTA'],
  ['sierra', 'Sierra Granada', 'SIE'],
  ['tramontana', 'Tramontana Girona', 'TRA'],
  ['union-astur', 'Unión Astur', 'UAS'],
]

export const DEFAULT_CLUBS: readonly Club[] = CLUBS.map(([id, name, shortName]) => ({
  id: id as ClubId,
  name,
  shortName,
}))
