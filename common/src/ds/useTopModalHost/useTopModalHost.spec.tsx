import { Dialog, Menu, MenuItem } from '@linagora/twake-mui'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { useTopModalHost } from './useTopModalHost'

function Host(): ReactElement {
  const host = useTopModalHost()
  const name = host?.element.querySelector('button')?.textContent ?? 'page'
  return <output>{host?.isHidden === true ? `${name} (hidden)` : name}</output>
}

function Modals({
  isMenuOpen = false
}: {
  isMenuOpen?: boolean
}): ReactElement {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  return (
    <>
      <Host />
      <button
        type="button"
        onClick={() => {
          setIsDrawerOpen(true)
        }}
      >
        Show folders
      </button>
      <Dialog open={isDrawerOpen} aria-label="Folders">
        <button
          type="button"
          onClick={() => {
            setIsDialogOpen(true)
          }}
        >
          Move folder
        </button>
      </Dialog>
      <Dialog open={isDialogOpen} aria-label="Move to">
        <button
          type="button"
          onClick={() => {
            setIsDialogOpen(false)
          }}
        >
          Alpha
        </button>
      </Dialog>
      <Menu open={isMenuOpen} anchorEl={document.body}>
        <MenuItem>Rename</MenuItem>
      </Menu>
    </>
  )
}

/** jsdom delivers mutation records in a promise */
async function flushMutations(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

function shownHost(): HTMLElement {
  return screen.getByRole('status', { hidden: true })
}

describe('useTopModalHost', () => {
  it('gives null without a modal', () => {
    renderDs(<Modals />)

    expect(shownHost()).toHaveTextContent('page')
  })

  it('follows the modal open over the others', async () => {
    renderDs(<Modals />)

    fireEvent.click(screen.getByRole('button', { name: 'Show folders' }))
    await flushMutations()
    expect(shownHost()).toHaveTextContent('Move folder')

    fireEvent.click(screen.getByRole('button', { name: 'Move folder' }))
    await flushMutations()
    expect(shownHost()).toHaveTextContent(/^Alpha$/)
  })

  it('leaves out a closing modal, the one under it hidden until it is done', async () => {
    renderDs(<Modals />)
    fireEvent.click(screen.getByRole('button', { name: 'Show folders' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move folder' }))
    await flushMutations()

    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }))
    await flushMutations()
    expect(shownHost()).toHaveTextContent('Move folder (hidden)')

    await waitFor(() => {
      expect(shownHost()).toHaveTextContent(/^Move folder$/)
    })
  })

  it('gives null for a menu, which has no modal element', async () => {
    renderDs(<Modals isMenuOpen />)
    await flushMutations()

    expect(shownHost()).toHaveTextContent('page')
  })
})
