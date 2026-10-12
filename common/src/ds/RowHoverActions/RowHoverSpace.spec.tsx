import { renderDs } from '@/ds/testing/renderDs'

import { RowHoverSpace } from './RowHoverSpace'

describe('RowHoverSpace', () => {
  it('only takes room: hidden from the eye and from assistive technologies', () => {
    const { container } = renderDs(
      <RowHoverSpace gap={16} hoverWidth={206}>
        <span>Oct 7</span>
      </RowHoverSpace>
    )

    const space = container.querySelector('[data-row-space]')
    expect(space).toHaveAttribute('aria-hidden', 'true')
    expect(space).toHaveStyle({ visibility: 'hidden' })
    expect(space).toHaveTextContent('Oct 7')
  })
})
