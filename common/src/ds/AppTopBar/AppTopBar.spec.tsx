import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState, type ReactElement, type RefObject } from 'react'
import { createPortal } from 'react-dom'

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

/** A bar whose overlay holds a button that empties it, as the selection bar */
function CoveredBar({ back }: { back: boolean }): ReactElement {
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null)
  const [isCovered, setIsCovered] = useState(true)
  const cover = isCovered ? (
    <button
      type="button"
      onClick={() => {
        setIsCovered(false)
      }}
    >
      Clear the selection
    </button>
  ) : null
  return (
    <>
      <AppTopBar
        title={<span>Inbox</span>}
        search={<input aria-label="Search emails" />}
        actions={<button type="button">Filter</button>}
        menu={{ label: 'Show folders', onOpen: jest.fn() }}
        overlayRef={setOverlay}
        back={
          back ? { label: 'Back to the mailbox', onBack: jest.fn() } : undefined
        }
      />
      {overlay === null ? null : createPortal(cover, overlay)}
    </>
  )
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

  it('on a tablet with a mouse, makes what the overlay covers inert while it holds something', async () => {
    mockViewport({ width: 820, touch: false })
    renderDs(<CoveredBar back={false} />)

    expect(
      screen.getByRole('button', { name: 'Show folders' })
    ).toHaveAttribute('inert')
    expect(screen.getByText('Inbox').parentElement).toHaveAttribute('inert')
    expect(
      screen.getByRole('button', { name: 'Filter' }).parentElement
    ).toHaveAttribute('inert')
    expect(
      screen.getByRole('button', { name: 'Clear the selection' })
    ).not.toHaveAttribute('inert')
    // The search under the bar is not covered
    expect(
      screen.getByRole('textbox', { name: 'Search emails' }).parentElement
    ).not.toHaveAttribute('inert')

    await userEvent.click(
      screen.getByRole('button', { name: 'Clear the selection' })
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Show folders' })
      ).not.toHaveAttribute('inert')
    })
    expect(
      screen.getByRole('button', { name: 'Filter' }).parentElement
    ).not.toHaveAttribute('inert')
  })

  it('on a tablet with a mouse, makes the back button and the search inert under the overlay in the search view', () => {
    mockViewport({ width: 820, touch: false })
    renderDs(<CoveredBar back />)

    expect(
      screen.getByRole('button', { name: 'Back to the mailbox' })
    ).toHaveAttribute('inert')
    expect(
      screen.getByRole('textbox', { name: 'Search emails' }).parentElement
    ).toHaveAttribute('inert')
  })

  it.each([
    ['a phone', 390],
    ['a touch tablet', 820]
  ])(
    'on %s, puts the overlay in place of the bar and of the search while it holds something',
    async (_screen, width) => {
      mockViewport({ width, touch: true })
      renderDs(<CoveredBar back={false} />)

      expect(screen.queryByRole('button', { name: 'Show folders' })).toBe(null)
      expect(screen.queryByRole('textbox', { name: 'Search emails' })).toBe(
        null
      )
      expect(
        screen.getByRole('button', { name: 'Clear the selection' })
      ).toBeVisible()

      await userEvent.click(
        screen.getByRole('button', { name: 'Clear the selection' })
      )

      expect(
        await screen.findByRole('button', { name: 'Show folders' })
      ).toBeVisible()
      expect(
        screen.getByRole('textbox', { name: 'Search emails' })
      ).toBeVisible()
    }
  )

  it('on a phone, puts the overlay in place of the search bar of the search view', () => {
    renderDs(<CoveredBar back />)

    expect(screen.queryByRole('button', { name: 'Back to the mailbox' })).toBe(
      null
    )
    expect(screen.queryByRole('textbox', { name: 'Search emails' })).toBe(null)
    expect(
      screen.getByRole('button', { name: 'Clear the selection' })
    ).toBeVisible()
  })
})
