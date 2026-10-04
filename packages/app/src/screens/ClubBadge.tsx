import { Badge } from '@fm/design-system'
import { badgeFor } from './badges.ts'

/**
 * A club's badge: the design system's `Badge`, wearing the colours, pattern and
 * shape this club is given in `badges.ts`.
 */
export interface ClubBadgeProps {
  /**
   * Widened from `Club` to the three fields this actually reads, so a
   * `ForeignClub` — which has no rating split, capacity or ledger — fits without
   * a cast. One line, and it is what unblocks every badge site abroad.
   */
  readonly club: { readonly id: string; readonly name: string; readonly shortName: string }
  /** `sm` for table rows and lists, `lg` for the hub's identity panel. */
  readonly size?: 'sm' | 'lg'
  /** See `Badge`: set when the club's name is not beside the badge. */
  readonly labelled?: boolean
}

export function ClubBadge({ club, size = 'sm', labelled = false }: ClubBadgeProps) {
  return (
    <Badge
      badge={badgeFor(club.id)}
      code={club.shortName}
      name={club.name}
      size={size}
      labelled={labelled}
    />
  )
}
