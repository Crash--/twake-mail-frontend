import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { NavigationDrawer } from './NavigationDrawer'

function DrawerWithOpener(): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const handleOpen = (): void => {
    setIsOpen(true)
  }
  const handleClose = (): void => {
    setIsOpen(false)
  }
  return (
    <>
      <button type="button" onClick={handleOpen}>
        Show folders
      </button>
      <a href="/behind">Behind the drawer</a>
      <NavigationDrawer
        open={isOpen}
        onClose={handleClose}
        label="Navigation"
        closeLabel="Close"
        header={<span>Twake Mail</span>}
        data-testid="drawer"
      >
        <a href="/inbox">Inbox</a>
        <a href="/sent">Sent</a>
      </NavigationDrawer>
    </>
  )
}

async function openDrawer(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole('button', { name: 'Show folders' }))
  return screen.findByRole('dialog', { name: 'Navigation' })
}

describe('NavigationDrawer', () => {
  it('renders nothing while it is closed', () => {
    renderDs(<DrawerWithOpener />)

    expect(screen.queryByRole('dialog')).toBe(null)
    expect(screen.queryByRole('link', { name: 'Inbox' })).toBe(null)
  })

  it('is a modal dialog named by its label, with a header and a close button', async () => {
    renderDs(<DrawerWithOpener />)

    const drawer = await openDrawer()

    expect(drawer).toHaveAttribute('aria-modal', 'true')
    expect(drawer).toBe(screen.getByTestId('drawer'))
    expect(within(drawer).getByText('Twake Mail')).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: 'Inbox' })).toBeVisible()
    expect(
      within(drawer).getByRole('button', { name: 'Close' })
    ).toBeInTheDocument()
  })

  it('moves the focus inside and keeps it there', async () => {
    renderDs(<DrawerWithOpener />)

    const drawer = await openDrawer()
    await waitFor(() => {
      expect(drawer).toContainElement(document.activeElement as HTMLElement)
    })

    for (let presses = 0; presses < 6; presses += 1) {
      await userEvent.tab()
      expect(drawer).toContainElement(document.activeElement as HTMLElement)
    }
    // The page behind is out of reach of screen readers too
    const behind = screen.getByText('Behind the drawer')
    expect(behind).not.toHaveFocus()
    expect(screen.queryByRole('link', { name: 'Behind the drawer' })).toBe(null)
  })

  it('closes on Escape and gives the focus back to the opener', async () => {
    renderDs(<DrawerWithOpener />)

    await openDrawer()
    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(screen.getByRole('button', { name: 'Show folders' })).toHaveFocus()
  })

  it('closes with its close button', async () => {
    renderDs(<DrawerWithOpener />)

    const drawer = await openDrawer()
    await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(screen.getByRole('button', { name: 'Show folders' })).toHaveFocus()
  })
})
