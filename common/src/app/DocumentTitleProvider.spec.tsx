import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import {
  useDocumentTitle,
  useUnreadCountInTitle
} from './DocumentTitleProvider'

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

  it('keeps the title of an email opened beside a list whose name comes late', async () => {
    function Titled({ title }: { title: string | null }): null {
      useDocumentTitle(title)
      return null
    }
    function Page(): ReactElement {
      const [listTitle, setListTitle] = useState<string | null>(null)
      const handleLoad = (): void => {
        setListTitle('Inbox')
      }
      return (
        <>
          <Titled title={listTitle} />
          <Titled title="Hello Alice" />
          <button type="button" onClick={handleLoad}>
            Load
          </button>
        </>
      )
    }
    renderWithProviders(<Page />)
    expect(document.title).toBe('Hello Alice - Twake Mail')

    await userEvent.click(screen.getByRole('button', { name: 'Load' }))

    expect(document.title).toBe('Hello Alice - Twake Mail')
  })

  it('puts the unread count before the title, and keeps the view when it changes', async () => {
    function Page(): ReactElement {
      const [count, setCount] = useState<number | null>(3)
      useDocumentTitle('Inbox')
      useUnreadCountInTitle(count)
      const handleRead = (): void => {
        setCount(previous => (previous ?? 0) - 1)
      }
      const handleReadAll = (): void => {
        setCount(0)
      }
      return (
        <>
          <button type="button" onClick={handleRead}>
            Read one
          </button>
          <button type="button" onClick={handleReadAll}>
            Read all
          </button>
        </>
      )
    }
    renderWithProviders(<Page />)
    expect(document.title).toBe('(3) Inbox - Twake Mail')

    await userEvent.click(screen.getByRole('button', { name: 'Read one' }))
    expect(document.title).toBe('(2) Inbox - Twake Mail')

    await userEvent.click(screen.getByRole('button', { name: 'Read all' }))
    expect(document.title).toBe('Inbox - Twake Mail')
  })
})
