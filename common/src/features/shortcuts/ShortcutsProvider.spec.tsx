import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'

import { ShortcutsProvider, useShortcuts } from './ShortcutsProvider'
import { SHORTCUTS_STORAGE_KEY } from './shortcutsSetting'

function Screen({
  onArchive,
  isActive = true
}: {
  onArchive: () => void
  isActive?: boolean
}): ReactElement {
  useShortcuts({ e: onArchive }, () => isActive)
  return (
    <>
      <label>
        Search
        <input />
      </label>
      <button type="button">Somewhere</button>
    </>
  )
}

function renderShortcuts(ui: ReactElement): void {
  render(
    <AppProviders lang="en" queryClient={makeQueryClient()}>
      <ShortcutsProvider>{ui}</ShortcutsProvider>
    </AppProviders>
  )
}

describe('ShortcutsProvider', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('runs the handler of a key pressed outside text fields', async () => {
    const onArchive = jest.fn()
    renderShortcuts(<Screen onArchive={onArchive} />)

    screen.getByRole('button', { name: 'Somewhere' }).focus()
    await userEvent.keyboard('e')
    expect(onArchive).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('textbox', { name: 'Search' }))
    await userEvent.keyboard('e')
    expect(onArchive).toHaveBeenCalledTimes(1)
  })

  it('ignores keys with a modifier', () => {
    const onArchive = jest.fn()
    renderShortcuts(<Screen onArchive={onArchive} />)

    fireEvent.keyDown(document.body, { key: 'e', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'e', altKey: true })

    expect(onArchive).not.toHaveBeenCalled()
  })

  it('takes the characters typed with AltGr, as "#" on a French keyboard', () => {
    const onDelete = jest.fn()
    function DeleteScreen(): ReactElement {
      useShortcuts({ '#': onDelete })
      return <p>Inbox</p>
    }
    renderShortcuts(<DeleteScreen />)

    fireEvent.keyDown(document.body, { key: '#', ctrlKey: true, altKey: true })

    expect(onDelete).toHaveBeenCalled()
  })

  it('gives a key to the last screen that handles it now', () => {
    const first = jest.fn()
    const second = jest.fn()
    renderShortcuts(
      <>
        <Screen onArchive={first} />
        <Screen onArchive={second} isActive={false} />
      </>
    )

    fireEvent.keyDown(document.body, { key: 'e' })

    expect(first).toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()
  })

  it('lists the shortcuts on "?", where they can be turned off', async () => {
    const onArchive = jest.fn()
    renderShortcuts(<Screen onArchive={onArchive} />)

    fireEvent.keyDown(document.body, { key: '?' })
    const dialog = await screen.findByRole('dialog', {
      name: 'Keyboard shortcuts'
    })
    expect(dialog).toHaveTextContent('Archive message')
    // Keys pressed in the dialog belong to it
    fireEvent.keyDown(dialog, { key: 'e' })
    expect(onArchive).not.toHaveBeenCalled()

    await userEvent.click(
      screen.getByRole('switch', { name: 'Enable keyboard shortcuts' })
    )
    expect(localStorage.getItem(SHORTCUTS_STORAGE_KEY)).toBe('false')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    act(() => {
      fireEvent.keyDown(document.body, { key: 'e' })
    })

    expect(onArchive).not.toHaveBeenCalled()
  })
})
