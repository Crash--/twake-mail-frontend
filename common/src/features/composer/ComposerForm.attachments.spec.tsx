import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  draftsOf,
  openComposer,
  renderComposer
} from '@common/testing/composerHarness'
import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  installFakeUploads,
  type FakeUploads
} from '@common/testing/fakeUploads'

import { clearComposerStorage } from './composerStorage'

// The saves are tested with the real delay in draftPolicy.spec.tsx
jest.mock('./draftPolicy', () => ({
  LOCAL_SAVE_DELAY_MS: 800,
  DRAFT_IDLE_MS: 1500
}))

// Apart from ComposerForm.spec.tsx: its jsdom piles up the styles of every
// test, which slows down the lookups of the last ones
describe('ComposerForm', () => {
  let uploads: FakeUploads | null = null

  afterEach(() => {
    uploads?.restore()
    uploads = null
    void clearComposerStorage()
  })

  describe('attachments', () => {
    it('uploads the files picked, which go with the draft, and removes them', async () => {
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      renderComposer(jmapServer)
      const composer = await openComposer()

      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        new File(['report'], 'report.pdf', { type: 'application/pdf' })
      )

      const list = await within(composer).findByRole('list', {
        name: 'Attachments (1)'
      })
      await waitFor(() => {
        expect(
          within(list).getByTestId('composer-attachment-item')
        ).toHaveAttribute('data-status', 'done')
      })
      // As tmail-flutter: a button beside "Delete", not in "More"
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Save as draft' })
      )
      await waitFor(() => {
        expect(draftsOf(jmapServer)[0]?.attachments).toEqual([
          expect.objectContaining({
            name: 'report.pdf',
            disposition: 'attachment'
          })
        ])
      })

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Remove report.pdf' })
      )
      expect(
        within(composer).queryByRole('list', { name: /Attachments/ })
      ).toBe(null)
    })

    it('cancels an upload removed while it runs', async () => {
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      uploads.hold()
      renderComposer(jmapServer)
      const composer = await openComposer()

      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        new File(['big'], 'big.zip', { type: 'application/zip' })
      )
      expect(
        await within(composer).findByRole('progressbar', {
          name: 'Uploading big.zip'
        })
      ).toBeInTheDocument()
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Remove big.zip' })
      )

      expect(uploads.held[0]?.isAborted()).toBe(true)
    })

    it('uploads a failed file again', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      uploads.hold()
      renderComposer(jmapServer)
      const composer = await openComposer()

      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        new File(['zip'], 'big.zip', { type: 'application/zip' })
      )
      await within(composer).findByRole('progressbar', {
        name: 'Uploading big.zip'
      })
      act(() => {
        uploads?.held[0]?.fail(500)
      })
      const item = await within(composer).findByTestId(
        'composer-attachment-item'
      )
      await waitFor(() => {
        expect(item).toHaveAttribute('data-status', 'failed')
      })
      expect(item).toHaveTextContent('Upload failed')

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Retry big.zip' })
      )
      await within(composer).findByRole('progressbar', {
        name: 'Uploading big.zip'
      })
      act(() => {
        uploads?.held[1]?.finish()
      })
      await waitFor(() => {
        expect(item).toHaveAttribute('data-status', 'done')
      })
    })

    it('folds a long list of files, and shows the rest again', async () => {
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      renderComposer(jmapServer)
      const composer = await openComposer()

      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        ['a', 'b', 'c', 'd'].map(
          name => new File([name], `${name}.txt`, { type: 'text/plain' })
        )
      )
      await waitFor(() => {
        expect(
          within(composer)
            .getAllByTestId('composer-attachment-item')
            .every(item => item.getAttribute('data-status') === 'done')
        ).toBe(true)
      })
      expect(
        within(composer).getAllByTestId('composer-attachment-item')
      ).toHaveLength(4)

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Show less' })
      )
      expect(
        within(composer).getAllByTestId('composer-attachment-item')
      ).toHaveLength(2)
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Show more (+2)' })
      )
      expect(
        within(composer).getAllByTestId('composer-attachment-item')
      ).toHaveLength(4)
    })

    it('lists more than 9 uploads at once in a popup, until they end', async () => {
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      uploads.hold()
      renderComposer(jmapServer)
      const composer = await openComposer()

      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        Array.from(
          { length: 10 },
          (_, index) =>
            new File(['x'], `file-${String(index)}.txt`, { type: 'text/plain' })
        )
      )

      const popup = await screen.findByRole('region', {
        name: 'Uploading 10 files'
      })
      expect(within(popup).getAllByRole('progressbar')).toHaveLength(10)
      expect(
        within(composer).queryAllByTestId('composer-attachment-item')
      ).toHaveLength(0)

      act(() => {
        uploads?.held.forEach(held => {
          held.finish()
        })
      })
      await waitFor(() => {
        expect(screen.queryByRole('region', { name: /Uploading/ })).toBe(null)
      })
      expect(
        within(composer).getAllByTestId('composer-attachment-item')
      ).toHaveLength(10)
    })

    it('refuses a file above the size limit of the server', async () => {
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      renderComposer(jmapServer)
      const composer = await openComposer()

      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        new File([new Uint8Array(20_000_001)], 'huge.bin')
      )

      const dialog = await screen.findByRole('dialog', {
        name: 'Maximum files size'
      })
      expect(dialog).toHaveTextContent('20 MB')
      expect(uploads.received).toEqual([])
    })
  })
})
