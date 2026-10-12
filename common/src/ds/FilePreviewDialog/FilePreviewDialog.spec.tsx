import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { FilePreviewDialog } from './FilePreviewDialog'

describe('FilePreviewDialog', () => {
  it('is a dialog named by the file, closed with Escape, downloaded from its bar', async () => {
    const onClose = jest.fn()
    const onDownload = jest.fn()
    renderDs(
      <FilePreviewDialog
        open
        title="report.pdf"
        closeLabel="Close"
        downloadLabel="Download"
        onClose={onClose}
        onDownload={onDownload}
      >
        <p>content</p>
      </FilePreviewDialog>
    )
    expect(
      screen.getByRole('dialog', { name: 'report.pdf' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(onDownload).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a click on the background, not on the file', async () => {
    const onClose = jest.fn()
    renderDs(
      <FilePreviewDialog
        open
        title="notes.txt"
        closeLabel="Close"
        onClose={onClose}
      >
        <p>content</p>
      </FilePreviewDialog>
    )
    await userEvent.click(screen.getByText('content'))
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('region', { name: 'notes.txt' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open when a selection dragged out of the file ends on the background', async () => {
    const onClose = jest.fn()
    renderDs(
      <FilePreviewDialog
        open
        title="notes.txt"
        closeLabel="Close"
        onClose={onClose}
      >
        <p>content</p>
      </FilePreviewDialog>
    )
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: screen.getByText('content') },
      {
        keys: '[/MouseLeft]',
        target: screen.getByRole('region', { name: 'notes.txt' })
      }
    ])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('has no download button until the file is loaded', () => {
    renderDs(
      <FilePreviewDialog open title="a" closeLabel="Close" onClose={jest.fn()}>
        <p>loading</p>
      </FilePreviewDialog>
    )
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
  })
})
