import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NotificationList } from './NotificationList.tsx'

describe('NotificationList', () => {
  it('says so when there is no news', () => {
    render(<NotificationList notices={[]} empty="Nothing yet." />)
    expect(screen.getByText('Nothing yet.')).toBeDefined()
  })

  it('tones each line', () => {
    const { container } = render(
      <NotificationList notices={[{ key: 'a', tone: 'bad', text: 'Lost.' }]} empty="" />,
    )
    expect(container.querySelector('li')?.className).toBe('notice-list__item is-bad')
  })
})
