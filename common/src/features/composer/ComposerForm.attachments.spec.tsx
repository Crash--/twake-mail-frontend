import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ATTACHMENT_DRAG_TYPE } from '@common/features/email/attachmentDrag'
import {
  draftsOf,
  fill,
  openComposer,
  renderComposer
} from '@common/testing/composerHarness'
import {
  FAKE_ACCOUNT_ID,
  makeFakeJmapServer
} from '@common/testing/fakeJmapServer'
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

// Apart from ComposerForm.spec.tsx: at the end of that file, its jsdom had
// grown enough to slow these tests down past their timeout (#368). They
// render the whole composer: a loaded machine still needs more than 5 s
jest.setTimeout(15_000)

describe('ComposerForm', () => {
  let uploads: FakeUploads | null = null

  afterEach(() => {
    uploads?.restore()
    uploads = null
    void clearComposerStorage()
  })

  describe('attachments', () => {
    it('attaches a file of an open email dropped on the body, without uploading it', async () => {
      const jmapServer = makeFakeJmapServer()
      renderComposer(jmapServer)
      const composer = await openComposer()
      const drag = (
        accountId: string
      ): { types: string[]; files: File[]; getData: () => string } => ({
        types: [ATTACHMENT_DRAG_TYPE],
        files: [],
        getData: () =>
          JSON.stringify({
            accountId,
            blobId: 'blob-report',
            type: 'application/pdf',
            name: 'report.pdf',
            size: 2048,
            charset: null
          })
      })
      const zone = within(composer).getByTestId('composer-drop-zone')

      fireEvent.drop(zone, { dataTransfer: drag('another-account') })
      expect(
        within(composer).queryByRole('list', { name: /Attachments/ })
      ).toBe(null)

      fireEvent.dragEnter(zone, { dataTransfer: drag(FAKE_ACCOUNT_ID) })
      expect(
        within(composer).getByText('Drop file here to attach them')
      ).toBeInTheDocument()
      fireEvent.drop(zone, { dataTransfer: drag(FAKE_ACCOUNT_ID) })

      const list = await within(composer).findByRole('list', {
        name: 'Attachments (1)'
      })
      expect(
        within(list).getByTestId('composer-attachment-item')
      ).toHaveAttribute('data-status', 'done')
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Save as draft' })
      )
      await waitFor(() => {
        expect(draftsOf(jmapServer)[0]?.attachments).toEqual([
          expect.objectContaining({
            type: 'application/pdf',
            name: 'report.pdf',
            disposition: 'attachment'
          })
        ])
      })
    })

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

    it('previews an uploaded file from its chip, and downloads one it cannot preview', async () => {
      const click = jest
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined)
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      renderComposer(jmapServer)
      const composer = await openComposer()

      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        [
          new File(['Meeting notes'], 'notes.txt', { type: 'text/plain' }),
          new File(['PK'], 'archive.zip', { type: 'application/zip' })
        ]
      )

      const preview = await within(composer).findByRole('button', {
        name: /^Preview notes\.txt \(/
      })
      await userEvent.click(preview)
      const dialog = await screen.findByTestId('attachment-preview')
      expect(
        await within(dialog).findByTestId('attachment-preview-text')
      ).toHaveTextContent('Meeting notes')
      await userEvent.keyboard('{Escape}')
      await waitFor(() => {
        expect(screen.queryByTestId('attachment-preview')).toBe(null)
      })
      expect(preview).toHaveFocus()

      await userEvent.click(
        within(composer).getByRole('button', {
          name: /^Download archive\.zip \(/
        })
      )
      await waitFor(() => {
        expect(click).toHaveBeenCalledTimes(1)
      })
      expect(screen.queryByTestId('attachment-preview')).toBe(null)
      click.mockRestore()
    })

    it('sends a text file with the charset of its bytes', async () => {
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      renderComposer(jmapServer)
      const composer = await openComposer()

      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        [
          new File([new TextEncoder().encode('Café')], 'utf8.txt', {
            type: 'text/plain'
          }),
          new File([new Uint8Array([0x43, 0x61, 0x66, 0xe9])], 'latin1.txt', {
            type: 'text/plain'
          })
        ]
      )

      const list = await within(composer).findByRole('list', {
        name: 'Attachments (2)'
      })
      await waitFor(() => {
        expect(
          within(list)
            .getAllByTestId('composer-attachment-item')
            .map(item => item.getAttribute('data-status'))
        ).toEqual(['done', 'done'])
      })
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Save as draft' })
      )
      await waitFor(() => {
        expect(draftsOf(jmapServer)[0]?.attachments).toEqual([
          expect.objectContaining({ name: 'utf8.txt', charset: 'UTF-8' }),
          expect.objectContaining({ name: 'latin1.txt', charset: 'ISO-8859-1' })
        ])
      })
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

    const failUpload = async (
      composer: HTMLElement,
      fakeUploads: FakeUploads
    ): Promise<void> => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)
      fakeUploads.hold()
      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        new File(['zip'], 'big.zip', { type: 'application/zip' })
      )
      await within(composer).findByRole('progressbar', {
        name: 'Uploading big.zip'
      })
      act(() => {
        fakeUploads.held[0]?.fail(500)
      })
      await waitFor(() => {
        expect(
          within(composer).getByTestId('composer-attachment-item')
        ).toHaveAttribute('data-status', 'failed')
      })
    }

    it('asks before sending without a failed file, then reminds it', async () => {
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      renderComposer(jmapServer)
      const composer = await openComposer()
      await fill(composer, { to: 'bob@example.com', subject: 'Report' })
      await userEvent.click(
        within(composer).getByRole('textbox', { name: 'Message body' })
      )
      await userEvent.keyboard('The PJ is there')
      await failUpload(composer, uploads)

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )
      const dialog = await screen.findByRole('dialog', {
        name: 'Attachment not uploaded'
      })
      expect(dialog).toHaveTextContent('"big.zip" could not be attached.')
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Cancel' })
      )
      expect(jmapServer.submitted).toEqual([])
      // The composer stays aria-hidden until the dialog has finished closing,
      // which takes more than the default second on a loaded machine
      await userEvent.click(
        await within(composer).findByRole(
          'button',
          { name: 'Send' },
          { timeout: 4000 }
        )
      )
      await userEvent.click(
        await screen.findByRole('button', { name: 'Send without' })
      )
      await userEvent.click(
        await screen.findByRole('button', { name: 'Send message' })
      )
      await waitFor(() => {
        expect(jmapServer.submitted).toHaveLength(1)
      })
    })

    it('uploads the failed files again instead of sending', async () => {
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      renderComposer(jmapServer)
      const composer = await openComposer()
      await fill(composer, { to: 'bob@example.com', subject: 'Report' })
      await failUpload(composer, uploads)

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )
      await userEvent.click(
        await screen.findByRole('button', { name: 'Retry' })
      )

      expect(
        await within(composer).findByRole('progressbar', {
          name: 'Uploading big.zip'
        })
      ).toBeInTheDocument()
      expect(jmapServer.submitted).toEqual([])
    })

    it('warns before sending more than 10 MB of attachments', async () => {
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      renderComposer(jmapServer)
      const composer = await openComposer()
      await fill(composer, { to: 'bob@example.com', subject: 'Video' })
      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'video.zip', {
          type: 'application/zip'
        })
      )
      await waitFor(() => {
        expect(
          within(composer).getByTestId('composer-attachment-item')
        ).toHaveAttribute('data-status', 'done')
      })

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )
      const dialog = await screen.findByRole('dialog', {
        name: 'Large message'
      })
      expect(dialog).toHaveTextContent(
        'Your message is larger than the size generally accepted'
      )
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Send anyway' })
      )
      await waitFor(() => {
        expect(jmapServer.submitted).toHaveLength(1)
      })
    })

    it('does not warn at 10 MB of attachments', async () => {
      const jmapServer = makeFakeJmapServer()
      uploads = installFakeUploads(jmapServer)
      renderComposer(jmapServer)
      const composer = await openComposer()
      await fill(composer, { to: 'bob@example.com', subject: 'Video' })
      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        new File([new Uint8Array(10 * 1024 * 1024)], 'video.zip', {
          type: 'application/zip'
        })
      )
      await waitFor(() => {
        expect(
          within(composer).getByTestId('composer-attachment-item')
        ).toHaveAttribute('data-status', 'done')
      })

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )
      await waitFor(() => {
        expect(jmapServer.submitted).toHaveLength(1)
      })
      expect(screen.queryByRole('dialog', { name: 'Large message' })).toBe(null)
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

    it('refuses an inline image above the size limit of the server', async () => {
      // jsdom draws no image: a GIF is never resized, its size is read only
      Object.defineProperty(globalThis, 'createImageBitmap', {
        value: () =>
          Promise.resolve({ width: 10, height: 10, close: jest.fn() }),
        configurable: true,
        writable: true
      })
      const jmapServer = makeFakeJmapServer()
      renderComposer(jmapServer)
      const composer = await openComposer()
      const imageInput = composer.querySelector<HTMLInputElement>(
        'input[type="file"]:not([data-testid])'
      )
      if (!imageInput) throw new Error('No image input')

      await userEvent.upload(
        imageInput,
        new File([new Uint8Array(20_000_001)], 'huge.gif', {
          type: 'image/gif'
        })
      )

      const dialog = await screen.findByRole('dialog', {
        name: 'Maximum files size'
      })
      Reflect.deleteProperty(globalThis, 'createImageBitmap')
      expect(dialog).toHaveTextContent('20 MB')
      expect(
        Array.from(jmapServer.blobs.keys()).filter(blobId =>
          blobId.startsWith('fetched-upload-')
        )
      ).toEqual([])
      expect(composer.querySelector('.ProseMirror img')).toBe(null)
    })
  })
})
