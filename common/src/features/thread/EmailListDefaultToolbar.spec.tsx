import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import {
  EmailListDefaultToolbar,
  type ListToolbarFilter
} from './EmailListDefaultToolbar'
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

function makeFilter(
  current: ListToolbarFilter['current'] = 'all'
): ListToolbarFilter {
  return {
    current,
    options: ['attachments', 'unread', 'starred'],
    onSelect: jest.fn(),
    onClear: jest.fn()
  }
}

interface ToolbarOptions {
  loadedCount?: number
  filter?: ListToolbarFilter | null
  isRefreshing?: boolean
}

function renderToolbar({
  loadedCount = 3,
  filter = makeFilter(),
  isRefreshing = false
}: ToolbarOptions = {}): {
  selection: EmailSelection
  onRefresh: jest.Mock
  filter: ListToolbarFilter | null
} {
  const selection = makeSelection()
  const onRefresh = jest.fn()
  renderWithProviders(
    <EmailListDefaultToolbar
      selection={selection}
      loadedCount={loadedCount}
      mailbox={null}
      filter={filter}
      isRefreshing={isRefreshing}
      onRefresh={onRefresh}
    />
  )
  return { selection, onRefresh, filter }
}

describe('EmailListDefaultToolbar', () => {
  afterEach(resetViewport)

  it('refreshes the list', async () => {
    const { onRefresh } = renderToolbar()

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('shows a spinner instead of the refresh button while refreshing', () => {
    renderToolbar({ isRefreshing: true })

    expect(screen.queryByRole('button', { name: 'Refresh' })).toBe(null)
    expect(screen.getByTestId('list-refresh-spinner')).toBeVisible()
  })

  it('selects the loaded emails of the page', async () => {
    const { selection } = renderToolbar()

    await userEvent.click(
      screen.getByRole('button', { name: 'Select all messages of this page' })
    )

    expect(selection.selectLoaded).toHaveBeenCalledTimes(1)
  })

  it('has no select all for an empty list', () => {
    renderToolbar({ loadedCount: 0 })

    expect(screen.queryByTestId('list-select-all-button')).toBe(null)
  })

  it('offers the filters, the active one checked, and picks one', async () => {
    const { filter } = renderToolbar({ filter: makeFilter('unread') })

    await userEvent.click(screen.getByRole('button', { name: 'Unread' }))
    expect(
      screen
        .getAllByRole('menuitemradio')
        .map(item => [item.textContent, item.getAttribute('aria-checked')])
    ).toEqual([
      ['With attachments', 'false'],
      ['Unread', 'true'],
      ['Starred', 'false']
    ])
    await userEvent.click(screen.getByTestId('quick-filter-starred'))

    expect(filter?.onSelect).toHaveBeenCalledWith('starred')
  })

  it('clears the active filter', async () => {
    const { filter } = renderToolbar({ filter: makeFilter('starred') })

    await userEvent.click(
      screen.getByRole('button', { name: 'Clear the filter' })
    )

    expect(filter?.onClear).toHaveBeenCalledTimes(1)
  })

  it('gives the focus back to the filter button after clearing', async () => {
    mockViewport({ width: 1440, touch: false })
    renderToolbar({ filter: makeFilter('starred') })

    await userEvent.click(
      screen.getByRole('button', { name: 'Clear the filter' })
    )

    expect(screen.getByTestId('list-filter-button')).toHaveFocus()
  })

  it('has no clear button without an active filter, nor a filter for search results', () => {
    renderToolbar()
    expect(screen.queryByTestId('list-filter-clear-button')).toBe(null)
  })

  it('has no filter button when the list has no filters', () => {
    renderToolbar({ filter: null })

    expect(screen.queryByTestId('list-filter-button')).toBe(null)
  })

  it.each([
    { device: 'phone', width: 390 },
    { device: 'tablet', width: 820 }
  ])(
    'is not shown on a $device, as tmail-flutter (the filter is in the bar)',
    ({ width }) => {
      mockViewport({ width, touch: true })
      renderToolbar()

      expect(screen.queryByTestId('list-toolbar')).toBe(null)
    }
  )
})
