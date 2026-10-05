import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { FramedDialog } from './FramedDialog'

/** The framed page says it is ready: a `frame-ready` event of the test */
function Harness({ isReadyAtOnce }: { isReadyAtOnce: boolean }): ReactElement {
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
        src="https://drive.example.com/pick"
        frameTitle="File picker"
        isReady={isReady}
        loadingLabel="Opening…"
        closeLabel="Close"
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}

describe('FramedDialog', () => {
  it('is a named dialog framing the page, busy until it is ready', async () => {
    renderDs(<Harness isReadyAtOnce={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pick files' }))

    expect(screen.getByRole('dialog', { name: 'Twake Drive' })).toBeVisible()
    expect(screen.getByTitle('File picker')).toHaveAttribute(
      'src',
      'https://drive.example.com/pick'
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
})
