import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { CompactRowAside } from './CompactRowAside'

describe('CompactRowAside', () => {
  it('puts the control beside the lines, out of the link', () => {
    renderDs(
      <CompactRowAside aside={<button type="button">Starred</button>}>
        <a href="/email/1">Topic</a>
      </CompactRowAside>
    )

    const link = screen.getByRole('link', { name: 'Topic' })
    const button = screen.getByRole('button', { name: 'Starred' })
    expect(link.contains(button)).toBe(false)
  })
})
