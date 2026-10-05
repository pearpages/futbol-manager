import { Button, Modal, NotificationList, ScreenActions } from '@fm/design-system'
import { useT } from '../i18n/useT.ts'
import { noticesFrom } from '../notifications.ts'
import { useGame } from '../store.ts'

/**
 * The whole news feed. Opened from the hub's news panel, and on a phone from the
 * bar's news button on every screen — news lands while you are in the market,
 * not only on the hub. Full-screen on a phone: it is a list (ADR 0019).
 */
export function NewsDialog({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const game = useGame((s) => s.game)
  const feed = useGame((s) => s.feed)
  const translator = useT()
  const { t } = translator

  return (
    <Modal title={t('hub.news')} onClose={onClose} full closeLabel={t('action.close')}>
      <NotificationList notices={noticesFrom(feed, game, translator)} empty={t('hub.noNews')} />
      <ScreenActions>
        <Button icon="close" type="button" onClick={onClose}>
          {t('action.close')}
        </Button>
      </ScreenActions>
    </Modal>
  )
}
