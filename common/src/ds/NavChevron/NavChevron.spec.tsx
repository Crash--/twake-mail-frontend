import { renderDs } from '@/ds/testing/renderDs'

import { NavChevron } from './NavChevron'

describe('NavChevron', () => {
  it('stays out of the accessibility tree', () => {
    const { container } = renderDs(<NavChevron isExpanded />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
