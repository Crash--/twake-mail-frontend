import { Icon } from '@linagora/twake-icons'

import { renderDs } from '@/ds/testing/renderDs'

import { KeyboardSettingsIcon } from './SettingsIcons'

describe('SettingsIcons', () => {
  it('draws in the current colour', () => {
    const { container } = renderDs(
      <>
        <Icon icon={KeyboardSettingsIcon} />
      </>
    )

    const paths = Array.from(container.querySelectorAll('path'))
    expect(paths.length).toBeGreaterThanOrEqual(1)
    paths.forEach(path => {
      expect(path).toHaveAttribute('fill', 'currentColor')
    })
  })
})
