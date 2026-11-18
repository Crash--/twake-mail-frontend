import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'
import type { UploadListItem } from '@/ds/UploadList/UploadList'

import { TransferDialog } from './TransferDialog'

const ITEMS: UploadListItem[] = [
  {
    id: 'a',
    name: 'report.pdf',
    size: '332 MB',
    status: 'uploading',
    progress: 40,
    icon: null
  },
  {
    id: 'b',
    name: 'photo.png',
    size: '20 MB',
    status: 'failed',
    progress: 0,
    icon: null
  }
]

function Dialog({
  onCancel,
  onRemove
}: {
  onCancel: () => void
  onRemove: (id: string) => void
}): ReactElement {
  return (
    <TransferDialog
      open
      title="Attaching file"
      description="Your file is larger than 25 MB."
      items={ITEMS}
      labels={{
        remove: name => `Cancel ${name}`,
        retry: name => `Retry ${name}`,
        progress: name => `Uploading ${name}`,
        failed: 'Upload failed',
        done: 'Uploaded'
      }}
      cancelLabel="Cancel"
      onCancel={onCancel}
      onRemove={onRemove}
      status="Uploading report.pdf"
      error="photo.png could not be sent"
      data-testid="transfer"
    />
  )
}

describe('TransferDialog', () => {
  afterEach(resetViewport)

  it.each([
    ['a desktop', { width: 1280 }],
    ['a phone', { width: 390, touch: true }]
  ])(
    'shows each file with its progress and cancels one or all, on %s',
    async (_, viewport) => {
      mockViewport(viewport)
      const onCancel = jest.fn()
      const onRemove = jest.fn()
      renderDs(<Dialog onCancel={onCancel} onRemove={onRemove} />)

      const dialog = screen.getByRole('dialog', { name: 'Attaching file' })
      expect(dialog).toHaveAccessibleDescription(
        'Your file is larger than 25 MB.'
      )
      expect(
        within(dialog).getByRole('progressbar', {
          name: 'Uploading report.pdf'
        })
      ).toHaveAttribute('aria-valuenow', '40')
      expect(within(dialog).getByText('Upload failed')).toBeVisible()
      expect(within(dialog).getByRole('status')).toHaveTextContent(
        'Uploading report.pdf'
      )
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'photo.png could not be sent'
      )
      expect(
        within(dialog).queryByRole('button', { name: 'Retry photo.png' })
      ).toBe(null)

      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Cancel report.pdf' })
      )
      expect(onRemove).toHaveBeenCalledWith('a')
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Cancel' })
      )
      expect(onCancel).toHaveBeenCalledTimes(1)
    }
  )

  it('cancels with Escape, not with a click outside', async () => {
    mockViewport({ width: 1280 })
    const onCancel = jest.fn()
    renderDs(<Dialog onCancel={onCancel} onRemove={jest.fn()} />)

    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    const backdrop = document.querySelector('.MuiBackdrop-root')
    if (backdrop === null) throw new Error('No backdrop')
    await userEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
