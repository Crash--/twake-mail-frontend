import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import { NoticeBanner } from './NoticeBanner'

describe('NoticeBanner', () => {
  afterEach(resetViewport)

  it('is a note with its message and its action', async () => {
    const onClick = jest.fn()
    renderDs(
      <NoticeBanner actions={[{ label: 'Empty trash now', onClick }]}>
        Trash is emptied when storage runs out.
      </NoticeBanner>
    )

    expect(screen.getByRole('note')).toHaveTextContent(
      'Trash is emptied when storage runs out.'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Empty trash now' })
    )
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('closes with a named button after its actions', async () => {
    const onDismiss = jest.fn()
    renderDs(
      <NoticeBanner
        actions={[{ label: 'View', onClick: () => undefined }]}
        dismiss={{ label: 'Close', onClick: onDismiss }}
      >
        1 message in spam
      </NoticeBanner>
    )

    const buttons = screen.getAllByRole('button')
    expect(
      buttons.map(button => button.textContent || button.ariaLabel)
    ).toEqual(['View', 'Close'])
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('puts its action on a row of its own on a phone', () => {
    mockViewport({ width: 390, touch: true })
    renderDs(
      <NoticeBanner actions={[{ label: 'Show', onClick: () => undefined }]}>
        Remote images are hidden.
      </NoticeBanner>
    )

    expect(screen.getByRole('note')).toHaveStyle({ flexWrap: 'wrap' })
  })
})
