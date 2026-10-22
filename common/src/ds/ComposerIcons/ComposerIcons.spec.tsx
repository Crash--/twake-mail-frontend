import { Icon } from '@linagora/twake-icons'

import { renderDs } from '@/ds/testing/renderDs'

import { FormattingIcon } from './ComposerIcons'

describe('ComposerIcons', () => {
  it('draws in the current colour', () => {
    const { container } = renderDs(
      <Icon icon={FormattingIcon} aria-hidden="true" />
    )

    const paths = Array.from(container.querySelectorAll('path'))
    expect(paths.length).toBeGreaterThan(0)
    paths.forEach(path => {
      expect(path).toHaveAttribute('fill', 'currentColor')
    })
  })
})
