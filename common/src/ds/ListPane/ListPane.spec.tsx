import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { ListPane } from './ListPane'

describe('ListPane', () => {
  it('holds its children', () => {
    renderDs(
      <ListPane>
        <span>Toolbar</span>
      </ListPane>
    )

    expect(screen.getByText('Toolbar')).toBeInTheDocument()
  })
})
