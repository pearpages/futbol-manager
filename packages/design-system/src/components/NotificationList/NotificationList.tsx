import { ScreenNote } from '../ScreenNote/ScreenNote.tsx'

/** One line of news: its key, how it reads (good, bad or plain) and the sentence. */
export interface NoticeItem {
  readonly key: string
  readonly tone: 'good' | 'bad' | 'plain'
  readonly text: string
}

/**
 * The hub's news panel. It was rendered in two places until the title bar's
 * drawer made way for the cog — kept as its own component because the empty
 * state is a real branch and inlining it would put a conditional in the middle
 * of the hub's layout.
 */
export function NotificationList({
  notices,
  empty,
}: {
  readonly notices: readonly NoticeItem[]
  /** What to say when there is no news. */
  readonly empty: string
}) {
  if (notices.length === 0) return <ScreenNote>{empty}</ScreenNote>

  return (
    <ul className="notice-list">
      {notices.map((notice) => (
        <li key={notice.key} className={`notice-list__item is-${notice.tone}`}>
          {notice.text}
        </li>
      ))}
    </ul>
  )
}
