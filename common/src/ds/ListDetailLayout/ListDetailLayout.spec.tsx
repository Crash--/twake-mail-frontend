import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'
import { WithoutTablets } from '@/ds/useScreenSize/useScreenSize'

import { ListDetailLayout, SplitOnDesktop } from './ListDetailLayout'

function Mailbox({ initiallyOpen }: { initiallyOpen: boolean }): ReactElement {
  const [isOpen, setIsOpen] = useState(initiallyOpen)
  const handleOpen = (): void => {
    setIsOpen(true)
  }
  const handleClose = (): void => {
    setIsOpen(false)
  }
  return (
    <ListDetailLayout
      list={
        <button type="button" onClick={handleOpen}>
          Hello Alice
        </button>
      }
      detail={
        isOpen ? (
          <button type="button" onClick={handleClose}>
            Back
          </button>
        ) : null
      }
      placeholder={<p>No email selected</p>}
    />
  )
}

function SwitchableMailbox(): ReactElement {
  const [isSplit, setIsSplit] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsSplit(true)
        }}
      >
        Split
      </button>
      <SplitOnDesktop isEnabled={isSplit}>
        <Mailbox initiallyOpen />
      </SplitOnDesktop>
    </>
  )
}

describe('ListDetailLayout', () => {
  afterEach(resetViewport)

  it.each([390, 820, 1440])(
    'shows the open item instead of the list on a %i px screen',
    width => {
      mockViewport({ width })

      renderDs(<Mailbox initiallyOpen />)

      expect(screen.getByRole('button', { name: 'Back' })).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Hello Alice' })).toBe(null)
      expect(screen.queryByText('No email selected')).toBe(null)
    }
  )

  it.each([390, 820, 1440])(
    'shows the list alone when nothing is open on a %i px screen',
    width => {
      mockViewport({ width })

      renderDs(<Mailbox initiallyOpen={false} />)

      expect(screen.getByRole('button', { name: 'Hello Alice' })).toBeVisible()
      expect(screen.queryByText('No email selected')).toBe(null)
    }
  )

  it('shows the list beside the open item on a large tablet', () => {
    mockViewport({ width: 1024 })

    renderDs(<Mailbox initiallyOpen />)

    expect(screen.getByRole('button', { name: 'Hello Alice' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible()
  })

  it('fills the room beside the list with the placeholder on a large tablet', () => {
    mockViewport({ width: 1024 })

    renderDs(<Mailbox initiallyOpen={false} />)

    expect(screen.getByRole('button', { name: 'Hello Alice' })).toBeVisible()
    expect(screen.getByText('No email selected')).toBeVisible()
  })

  it('replaces the list with the open item on a large tablet without tablets', () => {
    mockViewport({ width: 1024 })

    renderDs(
      <WithoutTablets>
        <Mailbox initiallyOpen />
      </WithoutTablets>
    )

    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Hello Alice' })).toBe(null)
    expect(screen.queryByText('No email selected')).toBe(null)
  })

  it('gives the focus back to the list when the item closes beside it', async () => {
    mockViewport({ width: 1024 })
    renderDs(<Mailbox initiallyOpen={false} />)

    await userEvent.click(screen.getByRole('button', { name: 'Hello Alice' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('No email selected')).toBeVisible()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hello Alice' })).toHaveFocus()
    })
  })

  describe('with the list beside the item on desktops', () => {
    it('shows the list beside the open item on a desktop', () => {
      mockViewport({ width: 1440 })

      renderDs(
        <SplitOnDesktop isEnabled>
          <Mailbox initiallyOpen />
        </SplitOnDesktop>
      )

      expect(screen.getByRole('button', { name: 'Hello Alice' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Back' })).toBeVisible()
      expect(
        screen.getByRole('button', { name: 'Hello Alice' }).parentElement
      ).toHaveStyle({ width: '375px' })
    })

    it('fills the room beside the list with the placeholder', () => {
      mockViewport({ width: 1440 })

      renderDs(
        <SplitOnDesktop isEnabled>
          <Mailbox initiallyOpen={false} />
        </SplitOnDesktop>
      )

      expect(screen.getByText('No email selected')).toBeVisible()
    })

    it('gives the focus back to the list when the item closes', async () => {
      mockViewport({ width: 1440 })
      renderDs(
        <SplitOnDesktop isEnabled>
          <Mailbox initiallyOpen={false} />
        </SplitOnDesktop>
      )

      await userEvent.click(screen.getByRole('button', { name: 'Hello Alice' }))
      expect(screen.getByRole('button', { name: 'Hello Alice' })).toBeVisible()
      await userEvent.click(screen.getByRole('button', { name: 'Back' }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Hello Alice' })
        ).toHaveFocus()
      })
    })

    it('follows the choice at once, the item staying open', async () => {
      mockViewport({ width: 1440 })
      renderDs(<SwitchableMailbox />)
      expect(screen.queryByRole('button', { name: 'Hello Alice' })).toBe(null)

      await userEvent.click(screen.getByRole('button', { name: 'Split' }))

      expect(screen.getByRole('button', { name: 'Hello Alice' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Back' })).toBeVisible()
    })

    it('keeps one at a time in a frame narrower than a desktop', () => {
      mockViewport({ width: 800 })

      renderDs(
        <WithoutTablets>
          <SplitOnDesktop isEnabled>
            <Mailbox initiallyOpen />
          </SplitOnDesktop>
        </WithoutTablets>
      )

      expect(screen.getByRole('button', { name: 'Back' })).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Hello Alice' })).toBe(null)
    })

    it.each([390, 820])('keeps one at a time on a %i px screen', width => {
      mockViewport({ width })

      renderDs(
        <SplitOnDesktop isEnabled>
          <Mailbox initiallyOpen />
        </SplitOnDesktop>
      )

      expect(screen.queryByRole('button', { name: 'Hello Alice' })).toBe(null)
    })
  })

  it.each([
    [390, 'list-detail-pane'],
    [1024, 'list-detail-item'],
    [1440, 'list-detail-pane']
  ])(
    'names what slides in a view transition on a %i px screen',
    (width, name) => {
      mockViewport({ width })

      renderDs(<Mailbox initiallyOpen />)

      const pane = screen.getByRole('button', { name: 'Back' }).parentElement
      expect(pane).toHaveStyle({ viewTransitionName: name })
    }
  )
})
