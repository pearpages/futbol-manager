import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { translatorFor } from '../i18n/useT.ts'
import { Explain } from './Explain.tsx'
import { EXPLAIN_TOPIC_IDS, EXPLAIN_TOPICS, keysFor } from './explain-topics.ts'

/**
 * The explainer button, driven directly rather than through `<App />` — the same
 * exception `Modal.test.tsx` makes, and for the same reason: this is a primitive,
 * and what it must guarantee is true of every screen that will ever hold one.
 *
 * The dialog's own behaviour (Escape, focus trap, backdrop) belongs to `Modal`
 * and is tested there. What is tested here is what this adds.
 */

const { t } = translatorFor('en')

describe('the explainer button', () => {
  it('names itself, so it is not twenty identical buttons to a screen reader', () => {
    render(<Explain topic="occupancy" />)
    const title = t('explain.occupancy.title')
    expect(screen.getByRole('button', { name: t('explain.open', { topic: title }) })).toBeDefined()
  })

  it('contributes no text to whatever it sits beside', () => {
    // The guarantee the whole component is shaped around. Two dozen assertions
    // across the suite resolve a control by its exact accessible name, and
    // `openScreen()` matches whole strings — a stray "i" folded into a heading
    // renames it and takes a whole suite down with it.
    render(
      <h2>
        Occupancy
        <Explain topic="occupancy" />
      </h2>,
    )
    expect(screen.getByRole('heading', { name: 'Occupancy' })).toBeDefined()
  })

  it('puts the dialog outside the heading it was opened from', () => {
    // The defect this exists for, and only a screenshot found it. The "i" belongs
    // beside a heading, so without a portal the dialog is a *child* of that `<h2>`
    // — invalid markup, and it inherits `text-transform: uppercase` and the
    // condensed face, which rendered nine paragraphs of body copy as shouting
    // capitals. `css: false` and jsdom's lack of layout mean no assertion can see
    // the type; this asserts the structure that caused it.
    render(
      <h2 className="screen__heading">
        Squad
        <Explain topic="squadTable" />
      </h2>,
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: t('explain.open', { topic: t('explain.squadTable.title') }),
      }),
    )

    const box = screen.getByRole('dialog')
    expect(box.closest('h2'), 'the dialog is nested inside the heading').toBeNull()
    expect(box.closest('.screen__heading'), 'the dialog inherits heading type').toBeNull()
  })

  it('opens the explanation and closes it again', async () => {
    render(<Explain topic="ticket" />)
    const title = t('explain.ticket.title')

    fireEvent.click(screen.getByRole('button', { name: t('explain.open', { topic: title }) }))
    const box = screen.getByRole('dialog')
    expect(within(box).getByRole('heading', { name: title })).toBeDefined()
    expect(within(box).getByText(t('explain.ticket.p1'))).toBeDefined()

    fireEvent.click(within(box).getByRole('button', { name: t('action.close') }))
    // Asserted through `waitFor`: the close lands a tick after the click, and a
    // synchronous check here is the race `SaveManagerModal.test.tsx` already hit.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('fills every placeholder, in every topic', () => {
    // A `{min}` left unsubstituted renders the brace literally on a screen
    // nobody opened. This walks the registry so a new topic cannot escape it.
    for (const topic of EXPLAIN_TOPIC_IDS) {
      render(<Explain topic={topic} />)
      const title = t(`explain.${topic}.title`)
      fireEvent.click(screen.getByRole('button', { name: t('explain.open', { topic: title }) }))
      const box = screen.getByRole('dialog')
      expect(box.textContent, topic).not.toMatch(/[{}]/)
      fireEvent.click(within(box).getByRole('button', { name: t('action.close') }))
    }
  })
})

describe('the topic registry', () => {
  it('has a real sentence behind every key it claims', () => {
    // `dictionaries.test.ts` checks the three languages agree with each other; it
    // cannot see a key that exists in all three and says nothing. This is the
    // half that catches a topic whose copy was never written.
    for (const topic of EXPLAIN_TOPIC_IDS) {
      for (const key of keysFor(topic)) {
        // `translate` returns the key itself when there is no entry.
        expect(t(key), key).not.toBe(key)
      }
    }
  })

  it('is reachable — every topic is used by a screen', () => {
    // The gap `CLAUDE.md` records four times: "parity is not coverage", and three
    // orphan keys have already shipped this way. A topic nobody renders is copy
    // written for nobody.
    const sources = import.meta.glob('./*.tsx', { eager: true, query: '?raw', import: 'default' })
    const used = Object.entries(sources)
      .filter(([path]) => !path.includes('Explain.'))
      .map(([, source]) => source as string)
      .join('\n')

    for (const topic of EXPLAIN_TOPIC_IDS) {
      expect(used, `${topic} is in the registry but on no screen`).toContain(`topic="${topic}"`)
    }
  })

  it('asks for a paragraph count that makes sense', () => {
    for (const topic of EXPLAIN_TOPIC_IDS) {
      expect(EXPLAIN_TOPICS[topic].paragraphs, topic).toBeGreaterThan(0)
    }
  })
})
