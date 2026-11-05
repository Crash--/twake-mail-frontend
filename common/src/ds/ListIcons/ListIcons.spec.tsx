import { Icon } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { EditOutlineIcon, MoreVerticalIcon } from './ListIcons'

describe('ListIcons', () => {
  it.each([
    ['more', MoreVerticalIcon],
    ['edit', EditOutlineIcon]
  ])('draw a path that Icon can size (%s)', (testId, icon) => {
    renderDs(<Icon icon={icon} size={16} data-testid={testId} />)

    expect(screen.getByTestId(testId).querySelector('path')).not.toBeNull()
  })
})
