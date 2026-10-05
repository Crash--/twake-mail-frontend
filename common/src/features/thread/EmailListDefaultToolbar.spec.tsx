import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailListDefaultToolbar } from './EmailListDefaultToolbar'
import type { EmailSelection } from './useEmailSelection'

function makeSelection(): EmailSelection {
  return {
    selected: [],
    isAllInFolder: false,
    isSelected: () => false,
    toggle: jest.fn(),
    selectLoaded: jest.fn(),
    selectAllInFolder: jest.fn(),
    clear: jest.fn()
  }
}

function renderToolbar(
  mailboxId: string | null,
  loadedCount = 3
): { selection: EmailSelection; onRefresh: jest.Mock } {
  const selection = makeSelection()
  const onRefresh = jest.fn()
  renderWithProviders(
    <EmailListDefaultToolbar
      selection={selection}
      loadedCount={loadedCount}
      mailboxId={mailboxId}
      onRefresh={onRefresh}
    />,
    {
      route: '/mailbox/inbox',
      routes: (
        <Route
          path="/search"
          element={<p data-testid="search-page">found</p>}
        />
      )
    }
  )
  return { selection, onRefresh }
}

describe('EmailListDefaultToolbar', () => {
  it('refreshes the list', async () => {
    const { onRefresh } = renderToolbar('inbox')

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('selects the loaded emails with "Select all"', async () => {
    const { selection } = renderToolbar('inbox')

    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))

    expect(selection.selectLoaded).toHaveBeenCalledTimes(1)
  })

  it('has nothing to select in an empty list', () => {
    renderToolbar('inbox', 0)

    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()
  })

  it('offers the filters of a folder, and shows the matching emails', async () => {
    renderToolbar('inbox')

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }))
    expect(
      screen.getAllByRole('menuitem').map(item => item.textContent)
    ).toEqual(['Unread', 'Starred', 'Has attachment'])
    await userEvent.click(screen.getByTestId('quick-filter-unread'))

    expect(await screen.findByTestId('search-page')).toBeVisible()
  })

  it('has no filter for search results', () => {
    renderToolbar(null)

    expect(screen.queryByRole('button', { name: 'Filter' })).toBe(null)
  })
})
