import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { Highlight } from './Highlight'

describe('Highlight', () => {
  it('marks its text', () => {
    renderDs(<Highlight>Card</Highlight>)

    const mark = screen.getByText('Card')
    expect(mark.tagName).toBe('MARK')
  })
})
