import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'

import {
  MAX_SUSPENSION_MS,
  ShortcutsProvider,
  useShortcuts,
  useSuspendShortcuts,
  type ReleaseShortcuts
} from './ShortcutsProvider'
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

  it('runs the handler of a key pressed on a checkbox, which is no text field', async () => {
    const onArchive = jest.fn()
    function SelectScreen(): ReactElement {
      useShortcuts({ e: onArchive })
      return <input type="checkbox" aria-label="Select Hello" />
    }
    renderShortcuts(<SelectScreen />)

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select Hello' })
    )
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

  it('reads a letter with Shift, not with its case (Caps Lock)', () => {
    const reply = jest.fn()
    const replyAll = jest.fn()
    function ReplyScreen(): ReactElement {
      useShortcuts({ r: reply, R: replyAll })
      return <p>Email</p>
    }
    renderShortcuts(<ReplyScreen />)

    // Caps Lock on: "R" without Shift
    fireEvent.keyDown(document.body, { key: 'R' })
    expect(reply).toHaveBeenCalledTimes(1)
    expect(replyAll).not.toHaveBeenCalled()

    // Shift, with or without Caps Lock
    fireEvent.keyDown(document.body, { key: 'r', shiftKey: true })
    fireEvent.keyDown(document.body, { key: 'R', shiftKey: true })
    expect(replyAll).toHaveBeenCalledTimes(2)
    expect(reply).toHaveBeenCalledTimes(1)
  })

  it("takes tmail-flutter's keys for the ones they stand for", () => {
    const onCompose = jest.fn()
    const onDelete = jest.fn()
    function MailScreen(): ReactElement {
      useShortcuts({ c: onCompose, '#': onDelete })
      return <p>Inbox</p>
    }
    renderShortcuts(<MailScreen />)

    fireEvent.keyDown(document.body, { key: 'n' })
    fireEvent.keyDown(document.body, { key: 'Delete' })
    fireEvent.keyDown(document.body, { key: 'Backspace' })

    expect(onCompose).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(2)
  })

  it('leaves the arrows to the controls moving with them', () => {
    const onNext = jest.fn()
    function ReaderScreen(): ReactElement {
      useShortcuts({ ArrowRight: onNext })
      return (
        <>
          <button type="button">Reply</button>
          <div role="tablist" aria-label="Categories">
            <button type="button" role="tab" aria-selected="true">
              Reading
            </button>
          </div>
        </>
      )
    }
    renderShortcuts(<ReaderScreen />)

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Reading' }), {
      key: 'ArrowRight'
    })
    expect(onNext).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('button', { name: 'Reply' }), {
      key: 'ArrowRight'
    })
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('ignores the keys while a view opens, until it is released', () => {
    jest.useFakeTimers()
    const onArchive = jest.fn()
    const releases: ReleaseShortcuts[] = []
    function Opening(): ReactElement {
      const suspend = useSuspendShortcuts()
      return (
        <button
          type="button"
          onClick={() => {
            releases.push(suspend())
          }}
        >
          Open
        </button>
      )
    }
    renderShortcuts(
      <>
        <Screen onArchive={onArchive} />
        <Opening />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.keyDown(document.body, { key: 'e' })
    expect(onArchive).not.toHaveBeenCalled()

    releases[0]?.()
    releases[0]?.()
    fireEvent.keyDown(document.body, { key: 'e' })
    expect(onArchive).toHaveBeenCalledTimes(1)

    // Never released: back after a while
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.keyDown(document.body, { key: 'e' })
    expect(onArchive).toHaveBeenCalledTimes(1)
    act(() => {
      jest.advanceTimersByTime(MAX_SUSPENSION_MS)
    })
    fireEvent.keyDown(document.body, { key: 'e' })
    expect(onArchive).toHaveBeenCalledTimes(2)
    jest.useRealTimers()
  })

  it('ignores the keys on the body while a modal dialog is open', () => {
    const onArchive = jest.fn()
    function Viewer({ isOpen }: { isOpen: boolean }): ReactElement {
      return isOpen ? (
        <div role="dialog" aria-modal="true" aria-label="Viewer" />
      ) : (
        <></>
      )
    }
    function ModalScreen({ isOpen }: { isOpen: boolean }): ReactElement {
      return (
        <>
          <Screen onArchive={onArchive} />
          <Viewer isOpen={isOpen} />
        </>
      )
    }
    const view = render(
      <AppProviders lang="en" queryClient={makeQueryClient()}>
        <ShortcutsProvider>
          <ModalScreen isOpen />
        </ShortcutsProvider>
      </AppProviders>
    )

    // The focused element of the dialog removed: the key is on the body
    fireEvent.keyDown(document.body, { key: 'e' })
    expect(onArchive).not.toHaveBeenCalled()

    view.rerender(
      <AppProviders lang="en" queryClient={makeQueryClient()}>
        <ShortcutsProvider>
          <ModalScreen isOpen={false} />
        </ShortcutsProvider>
      </AppProviders>
    )
    fireEvent.keyDown(document.body, { key: 'e' })
    expect(onArchive).toHaveBeenCalledTimes(1)
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
    // As tmail-flutter, by category: archiving is a matter of management
    expect(dialog).toHaveTextContent('Open new message')
    await userEvent.click(
      within(dialog).getByRole('tab', {
        name: 'Message Management & Selection'
      })
    )
    expect(dialog).toHaveTextContent('Archive message')
    expect(dialog).toHaveTextContent('Delete message# or Delete or Backspace')
    expect(
      within(dialog).getByRole('table', { name: 'In a message being written' })
    ).toHaveTextContent('Send the messageCtrl + Enter')
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
