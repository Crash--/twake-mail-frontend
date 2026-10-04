import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { AttachmentChip } from './AttachmentChip'

describe('AttachmentChip', () => {
  it('downloads the file from a named button, with the keyboard too', async () => {
    const onDownload = jest.fn()
    renderDs(
      <AttachmentChip
        name="report.pdf"
        size="12 KB"
        downloadLabel="Download"
        onDownload={onDownload}
      />
    )
    const chip = screen.getByRole('button', {
      name: 'Download report.pdf (12 KB)'
    })

    expect(chip).toHaveTextContent('report.pdf (12 KB)')
    await userEvent.click(chip)
    chip.focus()
    await userEvent.keyboard('{Enter}')
    expect(onDownload).toHaveBeenCalledTimes(2)
  })
})
