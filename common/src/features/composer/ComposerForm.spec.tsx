import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import {
  FAKE_ACCOUNT_ID,
  makeBodyPart,
  makeEmailWithBody,
  makeFakeJmapServer,
  makeIdentity,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  installFakeUploads,
  type FakeUploads
} from '@common/testing/fakeUploads'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { readSnapshot, type ComposerSnapshot } from './composerContent'
import { registryKey, snapshotKey, writeStorage } from './composerStorage'
import { ComposerProvider, useComposer } from './ComposerProvider'

function Opener(): ReactElement {
  const { openComposer } = useComposer()
  return (
    <>
      <button
        type="button"
        onClick={() => {
          openComposer()
        }}
      >
        Compose
      </button>
      <button
        type="button"
        onClick={() => {
          openComposer({ draftId: 'draft-1' })
        }}
      >
        Open draft
      </button>
      {(['reply', 'replyAll', 'forward'] as const).map(action => (
        <button
          key={action}
          type="button"
          onClick={() => {
            openComposer({ reply: { emailId: 'source-1', action } })
          }}
        >
          {`Answer ${action}`}
        </button>
      ))}
    </>
  )
}

function renderComposer(
  jmapServer: FakeJmapServer = makeFakeJmapServer()
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <ComposerProvider>
      <Opener />
    </ComposerProvider>,
    { jmapServer, withJmapSession: true }
  )
}

async function openComposer(name = 'Compose'): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole('button', { name }))
  const editor = await screen.findByRole('textbox', { name: 'Message body' })
  const composer = editor.closest('[role="dialog"]')
  if (!(composer instanceof HTMLElement)) throw new Error('No composer')
  return composer
}

async function fill(
  composer: HTMLElement,
  { to, subject }: { to?: string; subject?: string }
): Promise<void> {
  if (to !== undefined) {
    await userEvent.type(
      within(composer).getByRole('combobox', { name: 'To' }),
      `${to},`
    )
  }
  if (subject !== undefined) {
    await userEvent.type(
      within(composer).getByRole('textbox', { name: 'Subject' }),
      subject
    )
  }
}

function draftsOf(server: FakeJmapServer): typeof server.emails {
  return server.emails.filter(email => 'mailbox-drafts' in email.mailboxIds)
}

describe('ComposerForm', () => {
  let uploads: FakeUploads | null = null

  afterEach(() => {
    uploads?.restore()
    uploads = null
    sessionStorage.clear()
  })

  describe('sending', () => {
    it('sends the message, which lands in Sent, seen', async () => {
      const { jmapServer } = renderComposer()
      const composer = await openComposer()
      await fill(composer, { to: 'bob@example.com', subject: 'Hello' })

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )

      expect(await screen.findByTestId('toast')).toHaveTextContent(
        'Message has been sent successfully'
      )
      expect(screen.queryByRole('dialog', { name: 'Hello' })).toBe(null)
      expect(jmapServer.submitted).toHaveLength(1)
      const sent = jmapServer.emails.find(
        email => email.id === jmapServer.submitted[0]
      )
      expect(sent?.mailboxIds).toEqual({ 'mailbox-sent': true })
      expect(sent?.keywords).toEqual({ $seen: true })
      expect(sent?.to).toEqual([{ name: null, email: 'bob@example.com' }])
    })

    it('asks for a recipient first', async () => {
      const { jmapServer } = renderComposer()
      const composer = await openComposer()
      await fill(composer, { subject: 'Nobody' })

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )

      const alert = await screen.findByRole('dialog', {
        name: 'Sending failed'
      })
      expect(alert).toHaveTextContent(
        'Your email should have at least one recipient'
      )
      await userEvent.click(
        within(alert).getByRole('button', { name: 'Add recipients' })
      )
      expect(jmapServer.submitted).toEqual([])
    })

    it('refuses an invalid address', async () => {
      const { jmapServer } = renderComposer()
      const composer = await openComposer()
      await fill(composer, { to: 'wrong', subject: 'Invalid' })

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )

      expect(
        await screen.findByText(
          'Check the correctness of email addresses and try again'
        )
      ).toBeVisible()
      expect(jmapServer.submitted).toEqual([])
    })

    it('asks before sending without a subject', async () => {
      const { jmapServer } = renderComposer()
      const composer = await openComposer()
      await fill(composer, { to: 'bob@example.com' })

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )
      const dialog = await screen.findByRole('dialog', {
        name: 'Empty subject'
      })
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Send anyway' })
      )

      await waitFor(() => {
        expect(jmapServer.submitted).toHaveLength(1)
      })
    })

    it('says why the server refused it, the message kept as a draft', async () => {
      const jmapServer = makeFakeJmapServer()
      jmapServer.setErrors.set('submission', 'forbiddenMailFrom')
      renderComposer(jmapServer)
      const composer = await openComposer()
      await fill(composer, { to: 'bob@example.com', subject: 'Refused' })

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )

      expect(await within(composer).findByRole('alert')).toHaveTextContent(
        'Failure to send your message, because you may not send from this address.'
      )
      expect(screen.getByRole('dialog', { name: 'Refused' })).toBeVisible()
      expect(draftsOf(jmapServer).map(email => email.subject)).toEqual([
        'Refused'
      ])
    })
  })

  describe('drafts', () => {
    it('saves the draft once the typing stops, and closes without asking', async () => {
      const { jmapServer } = renderComposer()
      const composer = await openComposer()
      await fill(composer, { to: 'bob@example.com', subject: 'Autosaved' })

      await waitFor(
        () => {
          expect(
            within(composer).getByTestId('composer-save-status')
          ).toHaveTextContent('Draft saved')
        },
        { timeout: 4000 }
      )
      expect(draftsOf(jmapServer).map(email => email.subject)).toEqual([
        'Autosaved'
      ])

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Save & close' })
      )
      const toast = await screen.findByTestId('toast')
      expect(toast).toHaveTextContent('Draft saved')
      expect(screen.queryByRole('dialog', { name: 'Save message' })).toBe(null)

      // The draft made here can go at once
      await userEvent.click(
        within(toast).getByRole('button', { name: 'Discard' })
      )
      await waitFor(() => {
        expect(draftsOf(jmapServer)).toEqual([])
      })
    })

    it('reopens a draft with its fields and its identity, in one composer', async () => {
      const jmapServer = makeFakeJmapServer({
        identities: [
          makeIdentity({ id: 'identity-alice', mayDelete: false }),
          makeIdentity({ id: 'identity-work', name: 'Work', mayDelete: true })
        ],
        emails: [
          makeEmailWithBody(
            {
              id: 'draft-1',
              mailboxIds: { 'mailbox-drafts': true },
              keywords: { $draft: true, $seen: true },
              subject: 'Reopened',
              to: [{ name: 'Bob', email: 'bob@example.com' }],
              cc: [{ name: null, email: 'carol@example.com' }],
              headers: { 'X-JMAP-Identity': 'identity-work' }
            },
            { html: '<div>Draft body</div>' }
          )
        ]
      })
      renderComposer(jmapServer)
      const composer = await openComposer('Open draft')

      expect(
        within(composer).getByRole('textbox', { name: 'Subject' })
      ).toHaveValue('Reopened')
      expect(
        within(composer).getByRole('combobox', { name: 'Cc' })
      ).toBeVisible()
      expect(
        within(composer).queryByRole('combobox', { name: 'Reply to' })
      ).toBe(null)
      expect(
        within(composer).getByTestId('composer-identity-select')
      ).toHaveTextContent('Work')
      expect(
        within(composer).getByRole('textbox', { name: 'Message body' })
      ).toHaveTextContent('Draft body')

      // Opening it again shows the same composer
      await userEvent.click(screen.getByRole('button', { name: 'Open draft' }))
      expect(screen.getAllByRole('dialog', { name: 'Reopened' })).toHaveLength(
        1
      )
    })

    it('keeps the previous version of a draft when the server refuses the new one', async () => {
      const jmapServer = makeFakeJmapServer({
        emails: [
          makeEmailWithBody(
            {
              id: 'draft-1',
              mailboxIds: { 'mailbox-drafts': true },
              keywords: { $draft: true, $seen: true },
              subject: 'Kept',
              to: [{ name: 'Bob', email: 'bob@example.com' }]
            },
            { html: '<div>Draft body</div>' }
          )
        ]
      })
      jmapServer.setErrors.set('draft', 'overQuota')
      const error = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      renderComposer(jmapServer)
      const composer = await openComposer('Open draft')
      const status = within(composer).getByTestId('composer-save-status')

      await fill(composer, { subject: ' edited' })
      await waitFor(
        () => {
          expect(status).toHaveTextContent('Draft not saved')
        },
        { timeout: 4000 }
      )
      expect(draftsOf(jmapServer).map(email => email.id)).toEqual(['draft-1'])
      expect(draftsOf(jmapServer)[0]?.subject).toBe('Kept')

      // Accepted again: the new version replaces the old one
      jmapServer.setErrors.clear()
      await fill(composer, { subject: '!' })
      await waitFor(
        () => {
          expect(status).toHaveTextContent('Draft saved')
        },
        { timeout: 4000 }
      )
      expect(draftsOf(jmapServer).map(email => email.subject)).toEqual([
        'Kept edited!'
      ])
      error.mockRestore()
    }, 10_000)

    it('destroys with the next save a previous version it failed to destroy', async () => {
      const { jmapServer } = renderComposer()
      const composer = await openComposer()
      const status = within(composer).getByTestId('composer-save-status')
      await fill(composer, { to: 'bob@example.com', subject: 'One' })
      await waitFor(
        () => {
          expect(status).toHaveTextContent('Draft saved')
        },
        { timeout: 4000 }
      )
      const [first] = draftsOf(jmapServer)
      jmapServer.setErrors.set(first?.id ?? '', 'forbidden')
      const warn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined)

      await fill(composer, { subject: ' two' })
      await waitFor(
        () => {
          expect(draftsOf(jmapServer)).toHaveLength(2)
        },
        { timeout: 4000 }
      )

      jmapServer.setErrors.clear()
      await fill(composer, { subject: ' three' })
      await waitFor(
        () => {
          expect(draftsOf(jmapServer).map(email => email.subject)).toEqual([
            'One two three'
          ])
        },
        { timeout: 4000 }
      )
      warn.mockRestore()
      // Three autosaves
    }, 15_000)

    it('comes back after a reload, until closed', async () => {
      const snapshot: ComposerSnapshot = {
        identityId: 'identity-alice',
        recipients: {
          to: [{ name: null, email: 'bob@example.com' }],
          cc: [],
          bcc: [],
          replyTo: []
        },
        shown: [],
        subject: 'Before the reload',
        html: '<p>Kept text</p>',
        images: [],
        attachments: [],
        draftId: null,
        savedFingerprint: null
      }
      writeStorage(registryKey(FAKE_ACCOUNT_ID), [
        {
          id: 'composer-1',
          init: {},
          mode: 'normal',
          title: 'Before the reload'
        }
      ])
      writeStorage(snapshotKey(FAKE_ACCOUNT_ID, 'composer-1'), snapshot)
      renderComposer()

      const composer = await screen.findByRole('dialog', {
        name: 'Before the reload'
      })
      expect(
        await within(composer).findByRole('textbox', { name: 'Message body' })
      ).toHaveTextContent('Kept text')
      expect(
        within(composer)
          .getAllByTestId('recipient-chip')
          .map(chip => chip.textContent)
      ).toEqual(['bob@example.com'])

      // Unchanged since the reload: it closes at once
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Save & close' })
      )
      await waitFor(() => {
        expect(readSnapshot(snapshotKey(FAKE_ACCOUNT_ID, 'composer-1'))).toBe(
          null
        )
      })
    })
  })

  describe('answers', () => {
    function serverWithSource(): FakeJmapServer {
      return makeFakeJmapServer({
        emails: [
          makeEmailWithBody(
            {
              id: 'source-1',
              subject: 'Plans',
              from: [{ name: 'Emma', email: 'emma@example.com' }],
              to: [{ name: null, email: 'alice@example.com' }],
              cc: [{ name: null, email: 'carol@example.com' }],
              messageId: ['plans@example.com'],
              references: ['start@example.com'],
              attachments: [
                makeBodyPart({
                  partId: '2',
                  blobId: 'blob-report',
                  type: 'application/pdf',
                  name: 'report.pdf',
                  size: 2048,
                  disposition: 'attachment'
                })
              ]
            },
            { html: '<p>The original <b>plans</b></p>' }
          )
        ]
      })
    }

    it('replies to the sender with the quote, and marks the email answered once sent', async () => {
      const jmapServer = serverWithSource()
      renderComposer(jmapServer)
      const composer = await openComposer('Answer reply')

      expect(
        within(composer).getByRole('textbox', { name: 'Subject' })
      ).toHaveValue('Re: Plans')
      // The recipients are folded: the text has the focus
      await waitFor(() => {
        expect(
          within(composer).getByRole('textbox', { name: 'Message body' })
        ).toHaveFocus()
      })
      expect(within(composer).getByTitle('Quoted message')).toBeVisible()
      expect(
        within(composer).queryAllByTestId('composer-attachment-item')
      ).toEqual([])

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )
      expect(await screen.findByTestId('toast')).toHaveTextContent(
        'Message has been sent successfully'
      )
      const sent = jmapServer.emails.find(
        email => email.id === jmapServer.submitted[0]
      )
      expect(sent?.to).toEqual([{ name: 'Emma', email: 'emma@example.com' }])
      expect(sent?.subject).toBe('Re: Plans')
      expect(sent?.inReplyTo).toEqual(['plans@example.com'])
      expect(sent?.references).toEqual([
        'start@example.com',
        'plans@example.com'
      ])
      const html = Object.values(sent?.bodyValues ?? {})
        .map(value => value.value)
        .join('')
      expect(html).toContain('On ')
      expect(html).toContain('<b>plans</b>')
      await waitFor(() => {
        expect(
          jmapServer.emails.find(email => email.id === 'source-1')?.keywords
        ).toEqual({ $answered: true })
      })
    })

    it('brings back the answer already open instead of a second one', async () => {
      renderComposer(serverWithSource())
      const composer = await openComposer('Answer reply')
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Minimize' })
      )

      await userEvent.click(
        screen.getByRole('button', { name: 'Answer reply' })
      )

      await waitFor(() => {
        expect(
          within(composer).getByRole('textbox', { name: 'Message body' })
        ).toHaveFocus()
      })
      expect(screen.getAllByTestId('composer')).toHaveLength(1)
      // Another answer to the same email is another message
      await userEvent.click(
        screen.getByRole('button', { name: 'Answer forward' })
      )
      await waitFor(() => {
        expect(screen.getAllByTestId('composer')).toHaveLength(2)
      })
    })

    it('replies to all but the user, Cc kept', async () => {
      renderComposer(serverWithSource())
      const composer = await openComposer('Answer replyAll')

      await userEvent.click(
        within(composer).getByTestId('composer-recipients-summary')
      )
      expect(
        within(composer)
          .getAllByTestId('recipient-chip')
          .map(chip => chip.textContent)
      ).toEqual(['Emma', 'carol@example.com'])
    })

    it('forwards the files of the email, which can be removed', async () => {
      const jmapServer = serverWithSource()
      renderComposer(jmapServer)
      const composer = await openComposer('Answer forward')

      expect(
        within(composer).getByRole('textbox', { name: 'Subject' })
      ).toHaveValue('Fwd: Plans')
      expect(
        within(composer).getByRole('combobox', { name: 'To' })
      ).toHaveFocus()
      expect(
        within(composer).getByTestId('composer-attachment-item')
      ).toHaveTextContent('report.pdf')

      await fill(composer, { to: 'dan@example.com' })
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )
      expect(await screen.findByTestId('toast')).toHaveTextContent(
        'Message has been sent successfully'
      )
      const sent = jmapServer.emails.find(
        email => email.id === jmapServer.submitted[0]
      )
      expect(sent?.inReplyTo).toBe(null)
      expect(sent?.attachments?.map(part => part.name)).toEqual(['report.pdf'])
      await waitFor(() => {
        expect(
          jmapServer.emails.find(email => email.id === 'source-1')?.keywords
        ).toEqual({ $forwarded: true })
      })
    })
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
      await userEvent.click(
        within(composer).getByTestId('composer-more-button')
      )
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'Save as draft' })
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
