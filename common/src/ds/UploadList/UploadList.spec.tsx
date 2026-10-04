import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { UploadList } from './UploadList'

const LABELS = {
  list: 'Attachments (3)',
  remove: (name: string) => `Remove ${name}`,
  progress: (name: string) => `Uploading ${name}`,
  failed: 'Upload failed'
}

describe('UploadList', () => {
  it('lists the files with their state, and removes one', async () => {
    const onRemove = jest.fn()
    renderDs(
      <UploadList
        items={[
          {
            id: '1',
            name: 'report.pdf',
            size: '12 KB',
            status: 'done',
            progress: 100
          },
          {
            id: '2',
            name: 'photo.png',
            size: '2 MB',
            status: 'uploading',
            progress: 40
          },
          {
            id: '3',
            name: 'big.zip',
            size: '40 MB',
            status: 'failed',
            progress: 0
          }
        ]}
        labels={LABELS}
        onRemove={onRemove}
        status="report.pdf uploaded"
      />
    )

    const list = screen.getByRole('list', { name: 'Attachments (3)' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('report.pdf12 KB')
    expect(
      screen.getByRole('progressbar', { name: 'Uploading photo.png' })
    ).toHaveAttribute('aria-valuenow', '40')
    expect(items[2]).toHaveTextContent('Upload failed')
    expect(screen.getByRole('status')).toHaveTextContent('report.pdf uploaded')

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove photo.png' })
    )
    expect(onRemove).toHaveBeenCalledWith('2')
  })
})
