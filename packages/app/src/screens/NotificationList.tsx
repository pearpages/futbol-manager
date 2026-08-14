import { type Notice } from '../notifications.ts'

/**
 * One implementation, rendered in two places: the hub's news panel and the
 * drawer that opens from the shell bar. Writing it twice would guarantee they
 * drifted.
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
