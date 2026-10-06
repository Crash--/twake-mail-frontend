import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import { PickerSheet } from './PickerSheet'

function Sheet({ onClose }: { onClose: () => void }): ReactElement {
  return (
    <PickerSheet
      open
      onClose={onClose}
      title="Insert a template"
      closeLabel="Close"
      data-testid="sheet"
    >
      <input aria-label="Filter" />
    </PickerSheet>
  )
}

describe('PickerSheet', () => {
  afterEach(resetViewport)

  it('is a named dialog with a close button, on a desktop', async () => {
    mockViewport({ width: 1280 })
    const onClose = jest.fn()
    renderDs(<Sheet onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: 'Insert a template' })
    expect(
      within(dialog).getByRole('heading', { name: 'Insert a template' })
    ).toBeVisible()
    expect(within(dialog).getByLabelText('Filter')).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes with Escape', async () => {
    mockViewport({ width: 1280 })
    const onClose = jest.fn()
    renderDs(<Sheet onClose={onClose} />)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('is a modal sheet from the bottom on a phone, named the same', async () => {
    mockViewport({ width: 390, touch: true })
    const onClose = jest.fn()
    renderDs(<Sheet onClose={onClose} />)

    const sheet = screen.getByRole('dialog', { name: 'Insert a template' })
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(sheet).toHaveAttribute('data-testid', 'sheet')
    expect(within(sheet).getByLabelText('Filter')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
