import { ListItem } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { NavList } from './NavList'

describe('NavList', () => {
  it('is a list, without a navigation landmark of its own', () => {
    renderDs(
      <nav aria-label="Settings">
        <NavList>
          <ListItem>Profiles</ListItem>
        </NavList>
      </nav>
    )

    expect(screen.getAllByRole('navigation')).toEqual([
      screen.getByRole('navigation', { name: 'Settings' })
    ])
    expect(screen.getByRole('list')).toContainElement(
      screen.getByRole('listitem')
    )
  })
})
