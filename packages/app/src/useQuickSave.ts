import { useEffect, useState } from 'react'
import { useGame } from './store.ts'

/** How long the quick-save confirmation stays up. */
const CONFIRM_MS = 4000

/**
 * One press to save, shared by the desk footer and the phone menu.
 *
 * A brand-new career has no slot, and writing one without a name would put it
 * where the picker cannot show it — the dead end this feature first shipped
 * with. So the first save goes through the dialog (`openSaves`) and every one
 * after it is a single press.
 */
export function useQuickSave(openSaves: () => void): {
  readonly quickSave: () => void
  readonly saving: boolean
  /** The game date of the save just made, while its confirmation is up. */
  readonly savedOn: number | null
} {
  const save = useGame((s) => s.save)
  const saving = useGame((s) => s.saving)
  const currentSlot = useGame((s) => s.currentSlot)
  const game = useGame((s) => s.game)
  // The `n` is what makes two saves on the same day retrigger the timer; the
  // date alone would be an unchanged value and the effect would not re-run.
  const [saved, setSaved] = useState<{ readonly date: number; readonly n: number } | null>(null)

  useEffect(() => {
    if (saved === null) return
    const id = setTimeout(() => {
      setSaved(null)
    }, CONFIRM_MS)
    return () => {
      clearTimeout(id)
    }
  }, [saved])

  const quickSave = () => {
    if (currentSlot === null) {
      openSaves()
      return
    }
    void save().then(() => {
      setSaved((previous) => ({ date: game.season.currentDate, n: (previous?.n ?? 0) + 1 }))
    })
  }

  return { quickSave, saving, savedOn: saved?.date ?? null }
}
