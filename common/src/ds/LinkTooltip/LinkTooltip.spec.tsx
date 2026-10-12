import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { LinkTooltip } from './LinkTooltip'

describe('LinkTooltip', () => {
  it('writes the address under the link, hidden from assistive technologies', () => {
    renderDs(
      <LinkTooltip
        href="https://example.org/page"
        rect={{ top: 100, left: 40, bottom: 120 }}
        data-testid="tooltip"
      />
    )

    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip).toHaveTextContent('https://example.org/page')
    expect(tooltip).toHaveAttribute('aria-hidden', 'true')
    expect(tooltip).toHaveStyle({ top: '124px', left: '40px' })
  })
})
