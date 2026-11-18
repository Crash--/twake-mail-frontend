import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, type ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { SidePanel, type SidePanelProps } from './SidePanel'

function Panel(props: Partial<SidePanelProps>): ReactElement {
  return (
    <SidePanel
      label="Assistant"
      src="https://assistant.example.com/"
      frameTitle="Twake Assistant"
      isReady={false}
      loadingLabel="Opening…"
      onClose={jest.fn()}
      closeLabel="Close"
      frameRef={createRef()}
      {...props}
    />
  )
}

describe('SidePanel', () => {
  it('is a named landmark framing the page, busy until it is ready', () => {
    renderDs(<Panel />)

    expect(
      screen.getByRole('complementary', { name: 'Assistant' })
    ).toBeVisible()
    expect(screen.getByTitle('Twake Assistant')).toHaveAttribute(
      'src',
      'https://assistant.example.com/'
    )
    expect(screen.getByRole('status')).toHaveTextContent('Opening…')
  })

  it('moves the focus into the frame once it is ready', async () => {
    const { rerender } = renderDs(<Panel />)

    rerender(<Panel isReady />)

    expect(screen.queryByRole('status')).toBe(null)
    await waitFor(() => {
      expect(screen.getByTitle('Twake Assistant')).toHaveFocus()
    })
  })

  it('can be closed while it loads', async () => {
    const onClose = jest.fn()
    renderDs(<Panel onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('leaves the closing to the framed page once it is ready', () => {
    renderDs(<Panel isReady />)

    expect(screen.queryByRole('button', { name: 'Close' })).toBe(null)
  })

  it('shows a message instead of the frame, with its close button', () => {
    renderDs(<Panel message={<p>The assistant could not be opened.</p>} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The assistant could not be opened.'
    )
    expect(screen.queryByTitle('Twake Assistant')).toBe(null)
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()
  })
})
