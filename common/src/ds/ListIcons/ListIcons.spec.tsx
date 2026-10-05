import { Icon } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { CheckboxBlankIcon, FilterListIcon } from './ListIcons'

describe('ListIcons', () => {
  it('draw a path that Icon can size', () => {
    renderDs(
      <>
        <Icon icon={FilterListIcon} size={16} data-testid="filter" />
        <Icon icon={CheckboxBlankIcon} size={16} data-testid="checkbox" />
      </>
    )

    expect(screen.getByTestId('filter').querySelector('path')).not.toBeNull()
    expect(screen.getByTestId('checkbox').querySelector('path')).not.toBeNull()
  })
})
