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

  it('rises above the row link only when it sits in it', () => {
    const { container } = renderDs(
      <>
        <RowStateSlot inLink />
        <RowStateSlot />
      </>
    )

    const [inLink, outside] = Array.from(container.children)
    expect(inLink).toHaveStyle({ position: 'relative', zIndex: '1' })
    expect(outside).not.toHaveStyle({ position: 'relative' })
  })
})
