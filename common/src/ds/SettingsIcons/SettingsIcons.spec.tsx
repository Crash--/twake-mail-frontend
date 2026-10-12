import { Icon } from '@linagora/twake-icons'

import { renderDs } from '@/ds/testing/renderDs'

import { ProfilesSettingsIcon, SignOutSettingsIcon } from './SettingsIcons'

describe('SettingsIcons', () => {
  it('draws in the current colour', () => {
    const { container } = renderDs(
      <>
        <Icon icon={ProfilesSettingsIcon} />
        <Icon icon={SignOutSettingsIcon} />
      </>
    )

    const paths = Array.from(container.querySelectorAll('path'))
    expect(paths.length).toBeGreaterThanOrEqual(2)
    paths.forEach(path => {
      expect(path).toHaveAttribute('fill', 'currentColor')
    })
  })
})
