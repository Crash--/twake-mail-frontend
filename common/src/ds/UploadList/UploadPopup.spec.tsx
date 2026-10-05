import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { UploadPopup } from './UploadPopup'

describe('UploadPopup', () => {
  it('lists the uploads under a title, cancels one and closes', async () => {
    const onRemove = jest.fn()
    const onClose = jest.fn()
    renderDs(
      <UploadPopup
        title="Uploading 2 files"
        closeLabel="Hide the upload list"
        items={['a', 'b'].map(id => ({
          id,
          name: `${id}.pdf`,
          size: '1 KB',
          status: 'uploading' as const,
          progress: 10,
          icon: null
        }))}
        labels={{
          remove: name => `Remove ${name}`,
          retry: name => `Retry ${name}`,
          progress: name => `Uploading ${name}`,
          failed: 'Failed',
          done: 'Done'
        }}
        onRemove={onRemove}
        onRetry={jest.fn()}
        onClose={onClose}
      />
    )

    const region = screen.getByRole('region', { name: 'Uploading 2 files' })
    expect(within(region).getAllByRole('progressbar')).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'Remove b.pdf' }))
    expect(onRemove).toHaveBeenCalledWith('b')
    await userEvent.click(
      screen.getByRole('button', { name: 'Hide the upload list' })
    )
    expect(onClose).toHaveBeenCalled()
  })
})
