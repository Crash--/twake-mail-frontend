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
})
