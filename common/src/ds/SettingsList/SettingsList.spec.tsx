import { screen, within } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  SettingsList,
  SettingsListItem,
  SettingsListNameLine,
  SettingsListText
} from './SettingsList'

describe('SettingsList', () => {
  it('keeps the name beside a long chip: it does not shrink past half the line, the chip does', () => {
    renderDs(
      <SettingsListNameLine
        name="Newsletters"
        chip={<span>From, contains: news@example.com</span>}
        data-testid="name"
      />
    )

    const name = getComputedStyle(screen.getByTestId('name'))
    expect(name.flexShrink).toBe('0')
    expect(name.maxWidth).toBe('50%')
    expect(name.textOverflow).toBe('ellipsis')
    const chipSlot = screen.getByText(
      'From, contains: news@example.com'
    ).parentElement
    expect(chipSlot).toHaveStyle({ minWidth: '0' })
  })

  it('gives the whole line to the name without a chip', () => {
    renderDs(
      <SettingsListNameLine name="Newsletters" chip={null} data-testid="name" />
    )

    expect(getComputedStyle(screen.getByTestId('name')).maxWidth).not.toBe(
      '50%'
    )
  })

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
