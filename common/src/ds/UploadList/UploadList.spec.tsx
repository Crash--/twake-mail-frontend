import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { UploadList, type UploadListItem } from './UploadList'

const LABELS = {
  list: 'Attachments (3)',
  remove: (name: string) => `Remove ${name}`,
  retry: (name: string) => `Retry ${name}`,
  progress: (name: string) => `Uploading ${name}`,
  failed: 'Upload failed',
  done: 'Uploaded',
  showLess: 'Show less',
  showMore: (hidden: number) => `Show more (+${String(hidden)})`
}

function item(
  id: string,
  status: UploadListItem['status'] = 'done'
): UploadListItem {
  return {
    id,
    name: `file-${id}.pdf`,
    size: '12 KB',
    status,
    progress: status === 'done' ? 100 : 40,
    icon: <svg data-testid="icon" />
  }
}

describe('UploadList', () => {
  it('lists the files with their state, and removes or retries one', async () => {
    const onRemove = jest.fn()
    const onRetry = jest.fn()
    renderDs(
      <UploadList
        items={[
          item('1'),
          { ...item('2', 'uploading'), name: 'photo.png', size: '2 MB' },
          { ...item('3', 'failed'), name: 'big.zip', progress: 0 }
        ]}
        labels={LABELS}
        onRemove={onRemove}
        onRetry={onRetry}
        status="report.pdf uploaded"
      />
    )

    const list = screen.getByRole('list', { name: 'Attachments (3)' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('file-1.pdf12 KBUploaded')
    expect(
      screen.getByRole('progressbar', { name: 'Uploading photo.png' })
    ).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
    expect(items[2]).toHaveTextContent('Upload failed')
    expect(screen.getByRole('status')).toHaveTextContent('report.pdf uploaded')

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove photo.png' })
    )
    expect(onRemove).toHaveBeenCalledWith('2')
    await userEvent.click(screen.getByRole('button', { name: 'Retry big.zip' }))
    expect(onRetry).toHaveBeenCalledWith('3')
    expect(screen.queryByRole('button', { name: 'Retry file-1.pdf' })).toBe(
      null
    )
  })

  it('shows a thumbnail instead of the icon of a picture', () => {
    const { container } = renderDs(
      <UploadList
        items={[{ ...item('1'), thumbnailUrl: 'blob:thumb' }]}
        labels={LABELS}
        onRemove={jest.fn()}
        onRetry={jest.fn()}
      />
    )

    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:thumb')
    expect(screen.queryByTestId('icon')).toBe(null)
  })

  it('folds a long list once everything is uploaded, and unfolds it', async () => {
    renderDs(
      <UploadList
        items={[item('1'), item('2'), item('3'), item('4')]}
        labels={LABELS}
        onRemove={jest.fn()}
        onRetry={jest.fn()}
        foldedCount={2}
      />
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(5)

    await userEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    const more = screen.getByRole('button', { name: 'Show more (+2)' })
    expect(more).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(more)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('does not fold while a file uploads, nor a short list', () => {
    renderDs(
      <UploadList
        items={[item('1'), item('2'), item('3', 'uploading')]}
        labels={LABELS}
        onRemove={jest.fn()}
        onRetry={jest.fn()}
        foldedCount={2}
      />
    )
    expect(screen.queryByRole('button', { name: /Show/ })).toBe(null)
  })
})
