import { Icon } from '@linagora/twake-icons'

import { renderDs } from '@/ds/testing/renderDs'

import { SendMobileIcon } from './ComposerIcons'

describe('ComposerIcons', () => {
  it('draws the disc of Send in the current colour', () => {
    const { container } = renderDs(
      <Icon icon={SendMobileIcon} aria-hidden="true" />
    )

    expect(container.querySelector('circle')).toHaveAttribute(
      'fill',
      'currentColor'
    )
  })
})
