import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'
import { WithoutTablets } from '@/ds/useScreenSize/useScreenSize'

import { ListDetailLayout } from './ListDetailLayout'

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

function CountingList({ onOpen }: { onOpen: () => void }): ReactElement {
  const [count, setCount] = useState(0)
  const handleCount = (): void => {
    setCount(value => value + 1)
  }
  return (
    <>
      <button type="button" onClick={handleCount}>
        {`Counted ${String(count)}`}
      </button>
      <button type="button" onClick={onOpen}>
        Hello Alice
      </button>
    </>
  )
}

function CountingMailbox(): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const handleOpen = (): void => {
    setIsOpen(true)
  }
  const handleClose = (): void => {
    setIsOpen(false)
  }
  return (
    <ListDetailLayout
      list={<CountingList onOpen={handleOpen} />}
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

async function countOpenAndGoBack(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Counted 0' }))
  await userEvent.click(screen.getByRole('button', { name: 'Hello Alice' }))
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))
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

  it('keeps the list, hidden, while an item is open on a desktop', async () => {
    mockViewport({ width: 1440 })
    renderDs(<CountingMailbox />)

    await userEvent.click(screen.getByRole('button', { name: 'Hello Alice' }))

    expect(screen.queryByRole('button', { name: 'Hello Alice' })).toBe(null)
    expect(screen.getByText('Hello Alice')).not.toBeVisible()
  })

  it('shows the list again as it was when the item closes on a desktop', async () => {
    mockViewport({ width: 1440 })
    renderDs(<CountingMailbox />)

    await countOpenAndGoBack()

    expect(screen.getByRole('button', { name: 'Counted 1' })).toBeVisible()
  })

  it('builds the list again when the item closes on a phone', async () => {
    mockViewport({ width: 390 })
    renderDs(<CountingMailbox />)

    await countOpenAndGoBack()

    expect(screen.getByRole('button', { name: 'Counted 0' })).toBeVisible()
  })

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
