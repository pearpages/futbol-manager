import { type Notice } from '../notifications.ts'

/**
 * The hub's news panel. It was rendered in two places until the title bar's
 * drawer made way for the cog — kept as its own component because the empty
 * state is a real branch and inlining it would put a conditional in the middle
 * of the hub's layout.
 */
export function NotificationList({ notices, empty }: { notices: Notice[]; empty: string }) {
  if (notices.length === 0) return <p className="screen__note">{empty}</p>

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
