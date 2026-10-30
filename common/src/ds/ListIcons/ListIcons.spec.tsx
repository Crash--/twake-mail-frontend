import { Icon } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { MoreVerticalIcon } from './ListIcons'

describe('ListIcons', () => {
  it('draw a path that Icon can size', () => {
    renderDs(<Icon icon={MoreVerticalIcon} size={16} data-testid="more" />)

    expect(screen.getByTestId('more').querySelector('path')).not.toBeNull()
  })
})
