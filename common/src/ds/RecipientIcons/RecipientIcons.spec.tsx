import { Icon } from '@linagora/twake-icons'

import { renderDs } from '@/ds/testing/renderDs'

import * as RecipientIcons from './RecipientIcons'

describe('RecipientIcons', () => {
  it('draws every icon in the current colour', () => {
    const { container } = renderDs(
      <>
        {Object.values(RecipientIcons).map((icon, index) => (
          <Icon key={index} icon={icon} aria-hidden="true" />
        ))}
      </>
    )

    const svgs = Array.from(container.querySelectorAll('svg'))
    expect(svgs).toHaveLength(4)
    svgs.forEach(svg => {
      expect(svg.querySelector('path')).not.toBeNull()
    })
  })
})
