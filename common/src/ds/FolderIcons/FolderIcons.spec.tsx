import { Icon } from '@linagora/twake-icons'

import { renderDs } from '@/ds/testing/renderDs'

import * as FolderIcons from './FolderIcons'

describe('FolderIcons', () => {
  it('draws every folder icon in the current colour', () => {
    const { container } = renderDs(
      <>
        {Object.values(FolderIcons).map((icon, index) => (
          <Icon key={index} icon={icon} aria-hidden="true" />
        ))}
      </>
    )

    const paths = Array.from(container.querySelectorAll('path'))
    expect(paths.length).toBeGreaterThanOrEqual(12)
    paths.forEach(path => {
      expect(path).toHaveAttribute('fill', 'currentColor')
    })
  })
})
