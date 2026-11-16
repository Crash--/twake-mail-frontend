import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { FramedDialog } from './FramedDialog'

/** As cozy-interapp's `start`: a frame appended to the box */
function startFrame(container: HTMLElement | null): void {
  if (!container || container.querySelector('iframe')) return
  const frame = document.createElement('iframe')
  frame.src = 'https://drive.example.com/pick'
  frame.title = 'File picker'
  container.append(frame)
}

/** The framed page says it is ready: a `frame-ready` event of the test */
function Harness({
  isReadyAtOnce,
  showCloseButton
}: {
  isReadyAtOnce: boolean
  showCloseButton?: boolean
}): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [isReady, setIsReady] = useState(isReadyAtOnce)
  useEffect(() => {
    const handleReady = (): void => {
      setIsReady(true)
    }
    window.addEventListener('frame-ready', handleReady)
    return () => {
      window.removeEventListener('frame-ready', handleReady)
    }
  }, [])
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Pick files
      </button>
      <FramedDialog
        open={isOpen}
        title="Twake Drive"
        frameContainerRef={startFrame}
        frameTestId="picker-frame"
        isReady={isReady}
        loadingLabel="Opening…"
        closeLabel="Close"
        onClose={() => setIsOpen(false)}
        showCloseButton={showCloseButton}
      />
    </>
  )
}

describe('FramedDialog', () => {
  it('is a named dialog framing the page, busy until it is ready', async () => {
    renderDs(<Harness isReadyAtOnce={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pick files' }))

    expect(screen.getByRole('dialog', { name: 'Twake Drive' })).toBeVisible()
    expect(await screen.findByTitle('File picker')).toHaveAttribute(
      'src',
      'https://drive.example.com/pick'
    )
    expect(screen.getByTestId('picker-frame')).toContainElement(
      screen.getByTitle('File picker')
    )
    expect(screen.getByRole('status')).toHaveTextContent('Opening…')

    act(() => {
      window.dispatchEvent(new Event('frame-ready'))
    })
    expect(screen.queryByRole('status')).toBe(null)
    await waitFor(() => {
      expect(screen.getByTitle('File picker')).toHaveFocus()
    })
  })

  it('closes with its button and gives the focus back', async () => {
    renderDs(<Harness isReadyAtOnce />)
    const opener = screen.getByRole('button', { name: 'Pick files' })
    await userEvent.click(opener)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(opener).toHaveFocus()
  })
  it('leaves the close button to the framed page once it is ready; Escape still closes', async () => {
    renderDs(<Harness isReadyAtOnce={false} showCloseButton={false} />)
    const opener = screen.getByRole('button', { name: 'Pick files' })
    await userEvent.click(opener)
    // While the page loads, the dialog's own button
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()

    act(() => {
      window.dispatchEvent(new Event('frame-ready'))
    })
    expect(screen.queryByRole('button', { name: 'Close' })).toBe(null)
    // Still named, the focus outside the frame: Escape closes
    const dialog = screen.getByRole('dialog', { name: 'Twake Drive' })
    act(() => {
      dialog.focus()
    })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(opener).toHaveFocus()
  })
})
