import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AttributeRadar } from './AttributeRadar.tsx'

const labels = ['VEL', 'DEF', 'PAS', 'REG', 'ENT', 'AER', 'POR', 'RES']

describe('AttributeRadar', () => {
  it('is one image named by its title, with its eight axis labels', () => {
    render(
      <AttributeRadar
        values={[50, 50, 50, 50, 50, 50, 50, 50]}
        labels={labels}
        title="Attributes"
      />,
    )
    const chart = screen.getByRole('img', { name: 'Attributes' })
    for (const label of labels) expect(chart.textContent).toContain(label)
  })

  it('draws a second series only when there is someone to compare', () => {
    const values = [50, 50, 50, 50, 50, 50, 50, 50]
    const { container, rerender } = render(
      <AttributeRadar values={values} labels={labels} title="A" />,
    )
    const shapes = () => container.querySelectorAll('polygon').length
    const alone = shapes()
    rerender(<AttributeRadar values={values} compare={values} labels={labels} title="A" />)
    expect(shapes()).toBeGreaterThan(alone)
  })
})
