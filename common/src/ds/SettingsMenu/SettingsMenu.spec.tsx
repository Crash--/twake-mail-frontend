import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ProfilesSettingsIcon } from '@/ds/SettingsIcons/SettingsIcons'
import { renderDs } from '@/ds/testing/renderDs'

import {
  SettingsMenuDivider,
  SettingsMenuItem,
  SettingsMenuList,
  SettingsMenuTitle
} from './SettingsMenu'

describe('SettingsMenu', () => {
  it('lists its entries, the selected one marked as the current page', async () => {
    const onClick = jest.fn()
    renderDs(
      <nav aria-labelledby="title">
        <SettingsMenuTitle id="title">Manage account</SettingsMenuTitle>
        <SettingsMenuList>
          <SettingsMenuItem
            icon={ProfilesSettingsIcon}
            label="Profiles"
            isSelected
          />
          <SettingsMenuItem
            icon={ProfilesSettingsIcon}
            label="Sign out"
            onClick={onClick}
          />
        </SettingsMenuList>
        <SettingsMenuDivider />
      </nav>
    )

    expect(
      screen.getByRole('navigation', { name: 'Manage account' })
    ).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Profiles' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
