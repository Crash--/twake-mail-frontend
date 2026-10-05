import { act, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import userEvent from '@testing-library/user-event'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import { AppTopBar, type AppTopBarSearchActions } from './AppTopBar'

const searchActions = createRef<AppTopBarSearchActions>()

function renderBar(onOpenMenu = jest.fn()): jest.Mock {
  renderDs(
    <AppTopBar
      searchActions={searchActions}
      title={<span>Twake Mail</span>}
      compactTitle={<span>Inbox</span>}
      search={<input aria-label="Search mail" />}
      actions={<button type="button">My account</button>}
      menu={{ label: 'Show folders', onOpen: onOpenMenu }}
      openSearchLabel="Search"
      closeSearchLabel="Back"
      data-testid="top-bar"
    />
  )
  return onOpenMenu
}

describe('AppTopBar', () => {
  afterEach(resetViewport)

  it('shows the title, the search and the actions on a desktop, no menu', () => {
    mockViewport({ width: 1440 })

    renderBar()

    expect(screen.getByText('Twake Mail')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Search mail' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'My account' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Show folders' })).toBe(null)
    expect(screen.queryByText('Inbox')).toBe(null)
  })

  it('adds the menu button on a tablet', async () => {
    mockViewport({ width: 820, touch: true })

    const onOpenMenu = renderBar()
    await userEvent.click(screen.getByRole('button', { name: 'Show folders' }))

    expect(onOpenMenu).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Twake Mail')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Search mail' })).toBeVisible()
  })

  it('folds the search behind a button on a phone, with the compact title', () => {
    mockViewport({ width: 390, touch: true })

    renderBar()

    expect(screen.getByText('Inbox')).toBeVisible()
    expect(screen.queryByText('Twake Mail')).toBe(null)
    expect(screen.queryByRole('textbox')).toBe(null)
    expect(screen.getByRole('button', { name: 'Show folders' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'My account' })).toBeVisible()
  })

  it('unfolds the search with the focus in it, and folds it back with Escape', async () => {
    mockViewport({ width: 390, touch: true })
    renderBar()

    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    const input = screen.getByRole('textbox', { name: 'Search mail' })
    await waitFor(() => {
      expect(input).toHaveFocus()
    })
    expect(screen.queryByRole('button', { name: 'Show folders' })).toBe(null)

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('textbox')).toBe(null)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Search' })).toHaveFocus()
    })
  })

  it('folds the search back with the back button', async () => {
    mockViewport({ width: 390, touch: true })
    renderBar()

    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.queryByRole('textbox')).toBe(null)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Search' })).toHaveFocus()
    })
  })

  it('focuses the search on demand on a desktop', () => {
    mockViewport({ width: 1440 })
    renderBar()

    act(() => {
      searchActions.current?.focusSearch()
    })

    expect(screen.getByRole('textbox', { name: 'Search mail' })).toHaveFocus()
  })

  it('unfolds the search on demand on a phone, then focuses it', async () => {
    mockViewport({ width: 390, touch: true })
    renderBar()

    act(() => {
      searchActions.current?.focusSearch()
    })

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Search mail' })).toHaveFocus()
    })

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('textbox')).toBe(null)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Search' })).toHaveFocus()
    })
  })
})
