import { Icon } from '@linagora/twake-icons'

import { renderDs } from '@/ds/testing/renderDs'

import { FormattingIcon, SaveDraftIcon } from './ComposerIcons'

describe('ComposerIcons', () => {
  it('draws in the current colour', () => {
    const { container } = renderDs(
      <>
        <Icon icon={SaveDraftIcon} aria-hidden="true" />
        <Icon icon={FormattingIcon} aria-hidden="true" />
      </>
    )

    const paths = Array.from(container.querySelectorAll('path'))
    expect(paths.length).toBeGreaterThan(1)
    paths.forEach(path => {
      expect(path).toHaveAttribute('fill', 'currentColor')
    })
  })
})
