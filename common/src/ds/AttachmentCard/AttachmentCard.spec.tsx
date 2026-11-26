import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import {
  AttachmentCard,
  AttachmentHeader,
  AttachmentTextButton,
  visibleAttachmentCount
} from './AttachmentCard'

describe('AttachmentCard', () => {
  it('opens and downloads from two named buttons, with the keyboard too', async () => {
    const onOpen = jest.fn()
    const onDownload = jest.fn()
    renderDs(
      <AttachmentCard
        name="report.pdf"
        size="12 KB"
        thumbnail={<svg />}
        openLabel="Preview"
        downloadLabel="Download"
        onOpen={onOpen}
        onDownload={onDownload}
      />
    )
    const open = screen.getByRole('button', {
      name: 'Preview report.pdf (12 KB)'
    })
    await userEvent.click(open)
    expect(onOpen).toHaveBeenCalledTimes(1)

    await userEvent.tab()
    expect(
      screen.getByRole('button', { name: 'Download report.pdf' })
    ).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('keeps the extension of a long name apart, so that it stays in view', () => {
    renderDs(
      <AttachmentCard
        name="a-long-report.pdf"
        size="12 KB"
        thumbnail={<svg />}
        openLabel="Preview"
        downloadLabel="Download"
        onOpen={jest.fn()}
        onDownload={jest.fn()}
      />
    )

    expect(screen.getByText('a-long-report')).toBeInTheDocument()
    expect(screen.getByText('.pdf')).toBeInTheDocument()
  })

  it('"Show +N more" is a button', async () => {
    const onClick = jest.fn()
    renderDs(<AttachmentTextButton label="Show +5 more" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'Show +5 more' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('titles the attachments with a heading', () => {
    renderDs(<AttachmentHeader title="2 Attachments (12 KB)" />)

    expect(
      screen.getByRole('heading', { name: '2 Attachments (12 KB)' })
    ).toBeVisible()
  })
})

describe('AttachmentCard save action', () => {
  const LABELS = {
    idle: 'Save to my Drive',
    saving: 'Saving to Drive…',
    saved: 'File saved to your Drive',
    open: 'See in Drive'
  }

  function renderSave(status: 'idle' | 'saving' | 'saved'): {
    onSave: jest.Mock
    onOpenSaved: jest.Mock
  } {
    const onSave = jest.fn()
    const onOpenSaved = jest.fn()
    renderDs(
      <AttachmentCard
        name="report.pdf"
        size="12 KB"
        thumbnail={<svg />}
        openLabel="Preview"
        downloadLabel="Download"
        onOpen={jest.fn()}
        onDownload={jest.fn()}
        save={{ status, labels: LABELS, onSave, onOpen: onOpenSaved }}
      />
    )
    return { onSave, onOpenSaved }
  }

  it('saves the file, before the download action', async () => {
    const { onSave, onOpenSaved } = renderSave('idle')
    const buttons = screen.getAllByRole('button')

    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
      'Preview report.pdf (12 KB)',
      'Save to my Drive report.pdf',
      'Download report.pdf'
    ])
    await userEvent.click(
      screen.getByRole('button', { name: 'Save to my Drive report.pdf' })
    )
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onOpenSaved).not.toHaveBeenCalled()
  })

  it('says it saves, keeps the focus and does nothing on a click meanwhile', async () => {
    const { onSave, onOpenSaved } = renderSave('saving')
    const button = screen.getByRole('button', {
      name: 'Saving to Drive… report.pdf'
    })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(button)
    expect(button).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenSaved).not.toHaveBeenCalled()
  })

  it('opens the saved file once saved', async () => {
    const { onSave, onOpenSaved } = renderSave('saved')

    await userEvent.click(
      screen.getByRole('button', { name: 'See in Drive report.pdf' })
    )
    expect(onOpenSaved).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('only says the file is saved when it cannot be opened', () => {
    renderDs(
      <AttachmentCard
        name="report.pdf"
        size="12 KB"
        thumbnail={<svg />}
        openLabel="Preview"
        downloadLabel="Download"
        onOpen={jest.fn()}
        onDownload={jest.fn()}
        save={{ status: 'saved', labels: LABELS, onSave: jest.fn() }}
      />
    )

    expect(
      screen.getByRole('status', {
        name: 'File saved to your Drive report.pdf'
      })
    ).toBeVisible()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('has no save action when none is given', () => {
    renderDs(
      <AttachmentCard
        name="report.pdf"
        size="12 KB"
        thumbnail={<svg />}
        openLabel="Preview"
        downloadLabel="Download"
        onOpen={jest.fn()}
        onDownload={jest.fn()}
      />
    )
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})

describe('visibleAttachmentCount', () => {
  it('shows every chip that fits on the row', () => {
    // 3 x 260 + 2 x 8
    expect(visibleAttachmentCount(3, 796, false)).toBe(3)
  })

  it('keeps room for "Show +N more" when they do not all fit, as tmail-flutter', () => {
    // 1188 - 150 - 20 - 32 = 986: three chips of 260 px, 8 px apart
    expect(visibleAttachmentCount(6, 1188, false)).toBe(3)
    expect(visibleAttachmentCount(6, 300, false)).toBe(1)
  })

  it('shows three on a phone, or before the row is measured', () => {
    expect(visibleAttachmentCount(6, 1188, true)).toBe(3)
    expect(visibleAttachmentCount(6, null, false)).toBe(3)
    expect(visibleAttachmentCount(2, null, false)).toBe(2)
  })
})
