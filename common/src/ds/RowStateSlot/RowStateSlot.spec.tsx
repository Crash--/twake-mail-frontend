import { renderDs } from '@/ds/testing/renderDs'

import { RowStateSlot } from './RowStateSlot'

describe('RowStateSlot', () => {
  it('holds its icon, and stays there empty', () => {
    const { container } = renderDs(
      <>
        <RowStateSlot>
          <i>Icon</i>
        </RowStateSlot>
        <RowStateSlot />
      </>
    )

    const [full, empty] = Array.from(container.children)
    expect(full).toHaveTextContent('Icon')
    expect(empty).toBeEmptyDOMElement()
  })
})
