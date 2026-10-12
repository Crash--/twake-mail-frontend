import { Icon } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { CheckboxBlankIcon, FilterListIcon, RefreshIcon } from './ListIcons'

describe('ListIcons', () => {
  it('draw a path that Icon can size', () => {
    renderDs(
      <>
        <Icon icon={FilterListIcon} size={16} data-testid="filter" />
        <Icon icon={CheckboxBlankIcon} size={16} data-testid="checkbox" />
        <Icon icon={RefreshIcon} size={16} data-testid="refresh" />
      </>
    )

    expect(screen.getByTestId('filter').querySelector('path')).not.toBeNull()
    expect(screen.getByTestId('checkbox').querySelector('path')).not.toBeNull()
    expect(screen.getByTestId('refresh').querySelector('path')).not.toBeNull()
  })
})
