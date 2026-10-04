import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShellCredit } from './ShellCredit.tsx'

describe('ShellCredit', () => {
  it('links pearpages by name and keeps the build stamp a separate word', () => {
    const { container } = render(
      <ShellCredit madeBy="Made by" buildLabel="Build" commit="abc1234" iconSrc="/icon.png" />,
    )
    expect(screen.getByRole('link', { name: 'pearpages' })).toBeDefined()
    expect(container.textContent).toBe('Made by pearpages · abc1234')
  })
})
