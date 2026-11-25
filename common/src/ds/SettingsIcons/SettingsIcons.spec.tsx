import { Icon } from '@linagora/twake-icons'

import { renderDs } from '@/ds/testing/renderDs'

import {
  KeyboardSettingsIcon,
  LabelImportantOutlineIcon
} from './SettingsIcons'

describe('SettingsIcons', () => {
  it('draws in the current colour', () => {
    const { container } = renderDs(
      <>
        <Icon icon={KeyboardSettingsIcon} />
        <Icon icon={LabelImportantOutlineIcon} />
      </>
    )

    const paths = Array.from(container.querySelectorAll('path'))
    expect(paths.length).toBeGreaterThanOrEqual(2)
    paths.forEach(path => {
      expect(path).toHaveAttribute('fill', 'currentColor')
    })
  })
})
