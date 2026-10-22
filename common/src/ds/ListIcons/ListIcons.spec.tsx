import { Icon } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { CheckboxBlankIcon, MoreVerticalIcon } from './ListIcons'

describe('ListIcons', () => {
  it('draw a path that Icon can size', () => {
    renderDs(
      <>
        <Icon icon={CheckboxBlankIcon} size={16} data-testid="checkbox" />
        <Icon icon={MoreVerticalIcon} size={16} data-testid="more" />
      </>
    )

    expect(screen.getByTestId('checkbox').querySelector('path')).not.toBeNull()
    expect(screen.getByTestId('more').querySelector('path')).not.toBeNull()
  })
})
