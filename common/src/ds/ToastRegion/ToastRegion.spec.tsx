import { Dialog, DialogContent } from '@linagora/twake-mui'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import {
  LIVE_REGIONS_SETTLE_DURATION,
  TOAST_DURATION,
  TOAST_WITH_ACTION_DURATION,
  ToastRegion,
  type ToastItem
} from './ToastRegion'

function Harness({
  initial,
  next,
  onClose
}: {
  initial: ToastItem | null
  next: ToastItem | null
  onClose: jest.Mock
}): ReactElement {
  const [toast, setToast] = useState(initial)
  const handleNext = (): void => {
    setToast(next)
  }
  return (
    <>
      <button type="button" onClick={handleNext}>
        Next toast
      </button>
      <ToastRegion
        toast={toast}
        onClose={onClose}
        closeLabel="Close"
        data-testid="toast"
      />
    </>
  )
}

const MOVED: ToastItem = {
  id: '1',
  message: 'Moved to Alpha',
  severity: 'success',
  action: { label: 'Undo', onClick: jest.fn() }
}

function DialogHarness({
  initial
}: {
  initial: ToastItem | null
}): ReactElement {
  const [toast, setToast] = useState(initial)
  const [isOpen, setIsOpen] = useState(false)
  const handleOpen = (): void => {
    setIsOpen(true)
  }
  const handleClose = (): void => {
    setIsOpen(false)
  }
  const handleNotify = (): void => {
    setToast(MOVED)
  }
  return (
    <>
      <button type="button" onClick={handleOpen}>
        Open
      </button>
      <Dialog open={isOpen} onClose={handleClose} aria-label="Folders">
        <DialogContent>
          <button type="button" onClick={handleNotify}>
            Move
          </button>
          <button type="button" onClick={handleClose}>
            Done
          </button>
        </DialogContent>
      </Dialog>
      <ToastRegion toast={toast} onClose={jest.fn()} closeLabel="Close" />
    </>
  )
}

function renderToast(
  toast: ToastItem | null,
  {
    next = null,
    onClose = jest.fn()
  }: { next?: ToastItem | null; onClose?: jest.Mock } = {}
): { onClose: jest.Mock } {
  renderDs(<Harness initial={toast} next={next} onClose={onClose} />)
  return { onClose }
}

/** jsdom delivers mutation records in a promise, which fake timers keep */
async function flushMutations(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

async function openDialog(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  await flushMutations()
}

describe('ToastRegion', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('announces a message politely through a live region present beforehand', () => {
    renderToast(null, {
      next: { id: '1', message: 'Moved to Trash', severity: 'success' }
    })
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()

    fireEvent.click(screen.getByRole('button', { name: 'Next toast' }))

    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('Moved to Trash')
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    expect(screen.getByTestId('toast')).toHaveTextContent('Moved to Trash')
  })

  it('keeps its live regions out of the flow of the page', () => {
    renderToast(null)
    // Absolute without offset, a hidden region would land under the last
    // element of the page and make the document scroll
    const container = screen.getByRole('status').parentElement
    expect(container).not.toBeNull()
    if (container === null) return
    expect(screen.getByRole('alert').parentElement).toBe(container)
    expect(window.getComputedStyle(container).position).toBe('fixed')
  })

  it('announces an error as an alert', () => {
    jest.useFakeTimers()
    renderToast({ id: '1', message: 'Connection error', severity: 'error' })
    // Shown with its live regions: once they settled
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()

    act(() => {
      jest.advanceTimersByTime(LIVE_REGIONS_SETTLE_DURATION)
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Connection error')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('closes after its duration', () => {
    jest.useFakeTimers()
    const { onClose } = renderToast({
      id: '1',
      message: 'Moved',
      severity: 'info'
    })

    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION - 1)
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(1)
    })

    expect(onClose).toHaveBeenCalledWith('1', 'timeout')
  })

  it('stays longer with an action, and runs it', async () => {
    jest.useFakeTimers()
    const undo = jest.fn()
    const { onClose } = renderToast({
      id: '1',
      message: 'Moved to Trash',
      severity: 'success',
      action: { label: 'Undo', onClick: undo }
    })

    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION)
    })
    expect(onClose).not.toHaveBeenCalled()
    jest.useRealTimers()

    const button = screen.getByRole('button', { name: 'Undo' })
    expect(button).toHaveAccessibleDescription('Moved to Trash')
    await userEvent.click(button)

    expect(undo).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledWith('1', 'action')
    expect(TOAST_WITH_ACTION_DURATION).toBeGreaterThan(TOAST_DURATION)
  })

  it('pauses while hovered or focused, then counts the time left', () => {
    jest.useFakeTimers()
    const { onClose } = renderToast({
      id: '1',
      message: 'Moved',
      severity: 'info'
    })
    const toast = screen.getByTestId('toast')

    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION / 2)
    })
    fireEvent.mouseEnter(toast)
    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION * 2)
    })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseLeave(toast)
    fireEvent.focus(screen.getByRole('button', { name: 'Close' }))
    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION * 2)
    })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.blur(screen.getByRole('button', { name: 'Close' }))
    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION / 2)
    })

    expect(onClose).toHaveBeenCalledWith('1', 'timeout')
  })

  it('stays until closed without a duration, and closes on Escape', async () => {
    jest.useFakeTimers()
    const { onClose } = renderToast({
      id: '1',
      message: 'Offline',
      severity: 'error',
      duration: null
    })
    act(() => {
      jest.advanceTimersByTime(TOAST_WITH_ACTION_DURATION * 10)
    })
    expect(onClose).not.toHaveBeenCalled()
    jest.useRealTimers()

    screen.getByRole('button', { name: 'Close' }).focus()
    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledWith('1', 'close')
  })

  describe('while a modal is open', () => {
    it('announces the toast and lets Tab reach its action inside it', async () => {
      renderDs(<DialogHarness initial={null} />)
      await userEvent.click(screen.getByRole('button', { name: 'Open' }))
      const dialog = await screen.findByRole('dialog')

      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Move' })
      )

      // The page behind is aria-hidden: found in the dialog only
      expect(within(dialog).getByRole('status')).toHaveTextContent(
        'Moved to Alpha'
      )
      await userEvent.tab()
      await userEvent.tab()
      expect(within(dialog).getByRole('button', { name: 'Undo' })).toHaveFocus()
    })

    it('announces again a toast just shown when the modal opens', async () => {
      jest.useFakeTimers()
      renderDs(<DialogHarness initial={MOVED} />)
      await openDialog()
      const status = within(screen.getByRole('dialog')).getByRole('status')
      // Left empty for a while, to be known before the message goes in
      expect(status).toBeEmptyDOMElement()

      act(() => {
        jest.advanceTimersByTime(LIVE_REGIONS_SETTLE_DURATION)
      })

      expect(status).toHaveTextContent('Moved to Alpha')
    })

    it('does not announce again an old toast, and gives the region back to the page', async () => {
      jest.useFakeTimers()
      renderDs(<DialogHarness initial={MOVED} />)
      act(() => {
        jest.advanceTimersByTime(TOAST_DURATION / 2)
      })
      expect(screen.getByRole('status')).toHaveTextContent('Moved to Alpha')

      await openDialog()
      const dialog = screen.getByRole('dialog')
      act(() => {
        jest.advanceTimersByTime(LIVE_REGIONS_SETTLE_DURATION)
      })

      expect(within(dialog).getByRole('status')).toBeEmptyDOMElement()
      expect(within(dialog).getByRole('button', { name: 'Undo' })).toBeVisible()

      fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
      // Once the dialog has faded out
      act(() => {
        jest.advanceTimersByTime(TOAST_DURATION)
      })
      await flushMutations()
      expect(screen.queryByRole('dialog')).toBe(null)
      expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible()
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })
  })
})
