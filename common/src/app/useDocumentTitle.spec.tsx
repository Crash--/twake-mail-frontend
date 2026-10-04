import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { useDocumentTitle } from './useDocumentTitle'

function View(): ReactElement {
  const [title, setTitle] = useState<string | null>('Inbox')
  useDocumentTitle(title)
  const handleClear = (): void => {
    setTitle(null)
  }
  return (
    <button type="button" onClick={handleClear}>
      Clear
    </button>
  )
}

describe('useDocumentTitle', () => {
  it('names the page after the view and the app', async () => {
    renderWithProviders(<View />)
    expect(document.title).toBe('Inbox - Twake Mail')

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(document.title).toBe('Twake Mail')
  })

  it('gives the title back to the view underneath when it goes', async () => {
    function Titled({ title }: { title: string }): null {
      useDocumentTitle(title)
      return null
    }
    function Page(): ReactElement {
      const [isOpen, setIsOpen] = useState(true)
      const handleClose = (): void => {
        setIsOpen(false)
      }
      return (
        <>
          <Titled title="Inbox" />
          {isOpen ? <Titled title="Hello Alice" /> : null}
          <button type="button" onClick={handleClose}>
            Close
          </button>
        </>
      )
    }
    renderWithProviders(<Page />)
    expect(document.title).toBe('Hello Alice - Twake Mail')

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(document.title).toBe('Inbox - Twake Mail')
  })
})
