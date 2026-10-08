import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, type RefObject } from 'react'

import { renderDs } from '@/ds/testing/renderDs'
import { mockViewport } from '@/ds/testing/mockViewport'

import { AppTopBar, type AppTopBarSearchActions } from './AppTopBar'

function renderBar(
  search: boolean,
  onOpen = jest.fn()
): {
  onOpen: jest.Mock
  actions: RefObject<AppTopBarSearchActions | null>
} {
  const actions = createRef<AppTopBarSearchActions>()
  renderDs(
    <AppTopBar
      title={<span>Inbox</span>}
      search={search ? <input aria-label="Search emails" /> : null}
      actions={<button type="button">Filter</button>}
      menu={{ label: 'Show folders', onOpen, 'data-testid': 'menu' }}
      searchActions={actions}
      data-testid="bar"
    />
  )
  return { onOpen, actions }
}

describe('AppTopBar', () => {
  beforeEach(() => {
    mockViewport({ width: 390, touch: true })
  })

  it('shows the menu button, the title, the actions and the search under them', async () => {
    const { onOpen } = renderBar(true)

    expect(screen.getByText('Inbox')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Search emails' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Show folders' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('focuses the search when asked', () => {
    const { actions } = renderBar(true)

    actions.current?.focusSearch()

    expect(screen.getByRole('textbox', { name: 'Search emails' })).toHaveFocus()
  })

  it('leaves the search out when there is none', () => {
    renderBar(false)

    expect(screen.queryByRole('textbox')).toBe(null)
  })
})
