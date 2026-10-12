import { screen, within } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  SettingsList,
  SettingsListItem,
  SettingsListText
} from './SettingsList'

describe('SettingsList', () => {
  it('lists rows with their content and actions', () => {
    renderDs(
      <SettingsList label="Identities">
        <SettingsListItem
          actions={<button type="button">Edit</button>}
          dataAttributes={{ 'data-name': 'Alice' }}
          data-testid="row"
        >
          <SettingsListText variant="name">Alice</SettingsListText>
          <SettingsListText variant="detail">
            alice@example.com
          </SettingsListText>
        </SettingsListItem>
      </SettingsList>
    )

    const list = screen.getByRole('list', { name: 'Identities' })
    const row = within(list).getByRole('listitem')
    expect(row).toHaveTextContent('Alicealice@example.comEdit')
    expect(row).toHaveAttribute('data-name', 'Alice')
  })
})
