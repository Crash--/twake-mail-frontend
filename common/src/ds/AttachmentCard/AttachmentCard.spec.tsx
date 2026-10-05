import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { AttachmentCard, AttachmentMoreCard } from './AttachmentCard'

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

  it('the "more" tile is a button', async () => {
    const onClick = jest.fn()
    renderDs(<AttachmentMoreCard label="+5 more" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: '+5 more' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
