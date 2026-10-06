import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import {
  FAKE_ACCOUNT_ID,
  makeBodyPart,
  makeEmailWithBody,
  makeFakeJmapServer,
  makeDefaultMailboxes,
  makeIdentity,
  makeMailbox,
  makeTeamMailboxes,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  installFakeUploads,
  type FakeUploads
} from '@common/testing/fakeUploads'
import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { parseSnapshot, type ComposerSnapshot } from './composerContent'
import {
  clearComposerStorage,
  listComposers,
  putComposer,
  resumeComposerStorage
} from './composerStorage'
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
      <button
        type="button"
        onClick={() => {
          openComposer({ templateId: 'template-1' })
        }}
      >
        Open template
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

/** Opens the identity selector, which a new message shows on request */
async function showFrom(composer: HTMLElement): Promise<void> {
  if (within(composer).queryByTestId('composer-identity-select') !== null) {
    return
  }
  // Once the subject has the focus, the recipients are folded
  const summary = within(composer).queryByTestId('composer-recipients-summary')
  if (summary !== null) await userEvent.click(summary)
  await userEvent.click(
    within(composer).getByTestId('composer-show-from-button')
  )
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
    // Pasted: typing it costs about 40 ms a character (a render of the composer each), which
    // a loaded CI runner multiplies
    await userEvent.click(
      within(composer).getByRole('textbox', { name: 'Subject' })
    )
    await userEvent.paste(subject)
  }
}

function draftsOf(server: FakeJmapServer): typeof server.emails {
  return server.emails.filter(email => 'mailbox-drafts' in email.mailboxIds)
}

// The saves are tested with the real delay in draftPolicy.spec.tsx
jest.mock('./draftPolicy', () => ({
  LOCAL_SAVE_DELAY_MS: 800,
  DRAFT_IDLE_MS: 1500
}))

describe('ComposerForm', () => {
  let uploads: FakeUploads | null = null

  afterEach(() => {
    uploads?.restore()
    uploads = null
    void clearComposerStorage()
  })

  /** A composer the browser kept, as a reload leaves it */
  async function keepComposer(
    title: string,
    snapshot: ComposerSnapshot
  ): Promise<void> {
    resumeComposerStorage()
    await putComposer({
      accountId: FAKE_ACCOUNT_ID,
      composerId: 'composer-1',
      entry: { id: 'composer-1', init: {}, mode: 'normal', title },
      snapshot
    })
  }

  /** What the browser keeps of the composers, once its writes are done */
  async function kept(): Promise<
    { id: string; snapshot: ComposerSnapshot | null }[]
  > {
    return (await listComposers(FAKE_ACCOUNT_ID)).map(stored => ({
      id: stored.composerId,
      snapshot: parseSnapshot(stored.snapshot)
    }))
  }

  describe('on a phone', () => {
    beforeEach(() => {
      mockViewport({ width: 390, touch: true })
    })

    afterEach(() => {
      resetViewport()
    })

    it('has a top bar instead of a footer, and shows the formatting on "Aa"', async () => {
      renderComposer()
      const composer = await openComposer()

      const bar = within(composer).getByTestId('composer-top-bar')
      expect(
        within(bar)
          .getAllByRole('button')
          .map(button => button.getAttribute('aria-label'))
      ).toEqual([
        'Save & close',
        'Formatting options',
        'Attach file',
        'Insert image',
        'Send',
        'More'
      ])
      expect(
        within(composer).queryByTestId('composer-delete-draft-button')
      ).toBe(null)
      expect(
        within(composer).queryByRole('toolbar', { name: 'Formatting options' })
      ).toBe(null)

      await userEvent.click(
        within(bar).getByRole('button', { name: 'Formatting options' })
      )
      expect(
        within(composer).getByRole('toolbar', { name: 'Formatting options' })
      ).toBeVisible()
    })

    it('keeps the link and the delete in the More menu', async () => {
      renderComposer()
      const composer = await openComposer()

      await userEvent.click(
        within(composer).getByRole('button', { name: 'More' })
      )
      const menu = await screen.findByRole('menu')
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .concat(within(menu).getAllByRole('menuitemcheckbox'))
          .map(item => item.textContent)
          .sort()
      ).toEqual(
        [
          'Insert link',
          'Insert template',
          'Save as draft',
          'Save as template',
          'Request read receipt',
          'Mark as important',
          'Delete draft'
        ].sort()
      )
    })
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

    it('asks a read receipt and marks the message important from "More"', async () => {
      const { jmapServer } = renderComposer()
      const composer = await openComposer()
      await fill(composer, { to: 'bob@example.com', subject: 'Options' })

      for (const [name, toast] of [
        ['Request read receipt', 'Request read receipt has been enabled'],
        ['Mark as important', 'Mark as important is enabled']
      ] as const) {
        await userEvent.click(
          within(composer).getByRole('button', { name: 'More' })
        )
        const item = screen.getByRole('menuitemcheckbox', { name })
        expect(item).toHaveAttribute('aria-checked', 'false')
        await userEvent.click(item)
        expect(await screen.findByTestId('toast')).toHaveTextContent(toast)
      }
      await userEvent.click(
        within(composer).getByRole('button', { name: 'More' })
      )
      expect(
        screen.getByRole('menuitemcheckbox', { name: 'Mark as important' })
      ).toHaveAttribute('aria-checked', 'true')
      await userEvent.keyboard('{Escape}')

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )

      await waitFor(() => {
        expect(jmapServer.submitted).toHaveLength(1)
      })
      const sent = jmapServer.emails.find(
        email => email.id === jmapServer.submitted[0]
      )
      expect(sent?.headers).toMatchObject({
        'Disposition-Notification-To': 'alice@example.com',
        'X-Priority': '1',
        Importance: 'high',
        Priority: 'urgent'
      })
      expect(sent?.replyTo).toEqual([
        { name: 'Alice Martin', email: 'alice@example.com' }
      ])
    })

    it('asks a read receipt by default when the user always does', async () => {
      renderComposer(
        makeFakeJmapServer({
          capabilities: { 'com:linagora:params:jmap:settings': {} },
          settings: { 'read.receipts.always': 'true' }
        })
      )
      const composer = await openComposer()

      await userEvent.click(
        within(composer).getByRole('button', { name: 'More' })
      )

      expect(
        screen.getByRole('menuitemcheckbox', { name: 'Request read receipt' })
      ).toHaveAttribute('aria-checked', 'true')
    })

    describe('as a team mailbox', () => {
      function makeTeamServer(): FakeJmapServer {
        return makeFakeJmapServer({
          mailboxes: [...makeDefaultMailboxes(), ...makeTeamMailboxes()],
          identities: [
            makeIdentity({ id: 'identity-alice', mayDelete: false }),
            makeIdentity({
              id: 'identity-team',
              name: 'Team',
              email: 'team@example.com'
            })
          ]
        })
      }

      async function chooseTeam(composer: HTMLElement): Promise<void> {
        await showFrom(composer)
        await userEvent.click(
          within(composer).getByTestId('composer-identity-select')
        )
        await userEvent.click(screen.getByRole('option', { name: /^Team/ }))
      }

      it('keeps the sent copy in the Sent of the team mailbox', async () => {
        const { jmapServer } = renderComposer(makeTeamServer())
        const composer = await openComposer()
        await fill(composer, { to: 'bob@example.com', subject: 'From team' })
        await chooseTeam(composer)

        await userEvent.click(
          within(composer).getByRole('button', { name: 'Send' })
        )

        expect(await screen.findByTestId('toast')).toHaveTextContent(
          'Message has been sent successfully'
        )
        const sent = jmapServer.emails.find(
          email => email.id === jmapServer.submitted[0]
        )
        expect(sent?.mailboxIds).toEqual({ 'team-sent': true })
      })

      it('saves the draft in the Drafts of the team mailbox', async () => {
        const { jmapServer } = renderComposer(makeTeamServer())
        const composer = await openComposer()
        await chooseTeam(composer)
        await fill(composer, { to: 'bob@example.com', subject: 'Team draft' })

        await waitFor(
          () => {
            expect(
              within(composer).getByTestId('composer-save-status')
            ).toHaveTextContent('Draft saved')
          },
          { timeout: 4000 }
        )
        expect(
          jmapServer.emails.map(email => [email.subject, email.mailboxIds])
        ).toEqual([['Team draft', { 'team-drafts': true }]])
      })

      it('moves the draft to the Drafts of the user when the identity goes back', async () => {
        const { jmapServer } = renderComposer(makeTeamServer())
        const composer = await openComposer()
        await chooseTeam(composer)
        await fill(composer, { to: 'bob@example.com', subject: 'Moving' })
        await waitFor(
          () => {
            expect(
              within(composer).getByTestId('composer-save-status')
            ).toHaveTextContent('Draft saved')
          },
          { timeout: 4000 }
        )

        await showFrom(composer)
        await userEvent.click(
          within(composer).getByTestId('composer-identity-select')
        )
        await userEvent.click(screen.getByRole('option', { name: /^Alice/ }))
        await userEvent.type(
          within(composer).getByRole('textbox', { name: 'Subject' }),
          '!'
        )

        await waitFor(
          () => {
            expect(jmapServer.emails.map(email => email.mailboxIds)).toEqual([
              { 'mailbox-drafts': true }
            ])
          },
          { timeout: 6000 }
        )
      }, 30_000)
    })

    it('shows the From line on request, with several identities only', async () => {
      const single = renderComposer()
      const first = await openComposer()
      expect(within(first).queryByTestId('composer-show-from-button')).toBe(
        null
      )
      expect(within(first).queryByTestId('composer-identity-select')).toBe(null)
      single.unmount()

      renderComposer(
        makeFakeJmapServer({
          identities: [
            makeIdentity({ id: 'identity-alice', mayDelete: false }),
            makeIdentity({ id: 'identity-work', name: 'Work', mayDelete: true })
          ]
        })
      )
      const composer = await openComposer()
      expect(within(composer).queryByTestId('composer-identity-select')).toBe(
        null
      )
      await userEvent.click(
        within(composer).getByTestId('composer-show-from-button')
      )
      expect(
        within(composer).getByTestId('composer-identity-select')
      ).toBeVisible()
      expect(within(composer).queryByTestId('composer-show-from-button')).toBe(
        null
      )
    })

    it('swaps the Bcc of the identity when another one is chosen', async () => {
      renderComposer(
        makeFakeJmapServer({
          identities: [
            makeIdentity({
              id: 'identity-alice',
              mayDelete: false,
              bcc: [{ name: null, email: 'archive@example.com' }]
            }),
            makeIdentity({
              id: 'identity-work',
              name: 'Work',
              mayDelete: true,
              bcc: [{ name: null, email: 'boss@example.com' }]
            })
          ]
        })
      )
      const composer = await openComposer()
      const bcc = (): string[] =>
        within(within(composer).getByTestId('composer-bcc-field'))
          .queryAllByTestId('recipient-chip')
          .map(chip => chip.textContent)
      expect(bcc()).toEqual(['archive@example.com'])

      await showFrom(composer)
      await userEvent.click(
        within(composer).getByTestId('composer-identity-select')
      )
      await userEvent.click(screen.getByRole('option', { name: /^Work/ }))

      expect(bcc()).toEqual(['boss@example.com'])
    })

    it('reminds a file said attached, not the one of the signature', async () => {
      const { jmapServer } = renderComposer(
        makeFakeJmapServer({
          identities: [
            makeIdentity({
              id: 'identity-alice',
              mayDelete: false,
              textSignature: 'Signature file'
            })
          ]
        })
      )
      const composer = await openComposer()
      await fill(composer, { to: 'bob@example.com', subject: 'Reminder' })
      const body = within(composer).getByRole('textbox', {
        name: 'Message body'
      })
      await userEvent.click(body)
      await userEvent.keyboard('The PJ is there')

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )

      const dialog = await screen.findByRole('dialog', {
        name: 'Forgot to attach a file?'
      })
      expect(dialog).toHaveTextContent(
        'You wrote "pj" in your message but did not add any attachments.'
      )
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Cancel' })
      )
      expect(jmapServer.submitted).toEqual([])

      await userEvent.click(
        await within(composer).findByRole('button', { name: 'Send' })
      )
      await userEvent.click(
        await screen.findByRole('button', { name: 'Send message' })
      )
      await waitFor(() => {
        expect(jmapServer.submitted).toHaveLength(1)
      })
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

    it('keeps the remote images of a reopened draft unloaded until asked', async () => {
      const jmapServer = makeFakeJmapServer({
        emails: [
          makeEmailWithBody(
            {
              id: 'draft-1',
              mailboxIds: { 'mailbox-drafts': true },
              keywords: { $draft: true, $seen: true },
              subject: 'Tracked',
              to: [{ name: null, email: 'bob@example.com' }]
            },
            {
              html: '<div>Hi <img src="https://tracker.example/p.png" alt="pixel"></div>'
            }
          )
        ]
      })
      renderComposer(jmapServer)
      const composer = await openComposer('Open draft')

      const image = (): Element | null =>
        composer.querySelector('img[alt="pixel"]')
      expect(image()?.getAttribute('src') ?? '').toBe('')
      const banner = within(composer).getByTestId('remote-content-banner')
      expect(banner).toHaveTextContent('hidden')

      await userEvent.click(
        within(banner).getByRole('button', { name: /show/i })
      )

      expect(image()).toHaveAttribute('src', 'https://tracker.example/p.png')
      expect(within(composer).queryByTestId('remote-content-banner')).toBe(null)
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

    it('destroys with the next save a version whose answer was lost', async () => {
      const { jmapServer } = renderComposer()
      const composer = await openComposer()
      const status = within(composer).getByTestId('composer-save-status')
      const error = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      jmapServer.loseNextResponse('Email/set')

      await fill(composer, { to: 'bob@example.com', subject: 'One' })
      await waitFor(
        () => {
          expect(status).toHaveTextContent('Draft not saved')
        },
        { timeout: 4000 }
      )
      // Created all the same, its id unknown to the composer
      expect(draftsOf(jmapServer)).toHaveLength(1)

      await fill(composer, { subject: ' two' })
      await waitFor(
        () => {
          expect(draftsOf(jmapServer).map(email => email.subject)).toEqual([
            'One two'
          ])
        },
        { timeout: 4000 }
      )
      expect(
        draftsOf(jmapServer)[0]?.headers?.['X-Twake-Draft-Session']
      ).toMatch(/^[0-9a-f-]{36}$/)
      error.mockRestore()
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
      await keepComposer('Before the reload', snapshot)
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

      // Never saved on the server: closing asks, what was typed is not lost
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Save & close' })
      )
      await userEvent.click(
        await screen.findByRole('button', { name: 'Discard changes' })
      )
      await waitFor(async () => {
        expect(await kept()).toEqual([])
      })
    })

    it('saves a composer back from the browser when its message was never saved, once the user stays idle', async () => {
      const snapshot: ComposerSnapshot = {
        identityId: 'identity-alice',
        recipients: {
          to: [{ name: null, email: 'bob@example.com' }],
          cc: [],
          bcc: [],
          replyTo: []
        },
        shown: [],
        subject: 'Typed before the reload',
        html: '<p>Kept text</p>',
        images: [],
        attachments: [],
        draftId: null,
        savedFingerprint: null
      }
      await keepComposer('Typed before the reload', snapshot)
      const { jmapServer } = renderComposer()
      await screen.findByRole('dialog', { name: 'Typed before the reload' })

      await waitFor(
        () => {
          expect(draftsOf(jmapServer).map(email => email.subject)).toEqual([
            'Typed before the reload'
          ])
        },
        { timeout: 4000 }
      )
    })

    it('keeps nothing of a message nobody typed in', async () => {
      renderComposer()
      await openComposer()

      window.dispatchEvent(new Event('pagehide'))
      // Let the writes of the browser settle
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(await kept()).toEqual([])
    })
  })

  describe('templates', () => {
    function templatesOf(server: FakeJmapServer): typeof server.emails {
      const folder = server.mailboxes.find(
        mailbox => mailbox.name === 'Templates'
      )
      return server.emails.filter(
        email => folder !== undefined && folder.id in email.mailboxIds
      )
    }

    async function saveAsTemplate(composer: HTMLElement): Promise<void> {
      await userEvent.click(
        within(composer).getByRole('button', { name: 'More' })
      )
      await userEvent.click(
        screen.getByRole('menuitem', { name: 'Save as template' })
      )
    }

    it('saves a message as a template, in a Templates folder made for it, then updates it', async () => {
      const jmapServer = makeFakeJmapServer()
      renderComposer(jmapServer)
      const composer = await openComposer()
      await fill(composer, { subject: 'test subject' })

      await saveAsTemplate(composer)

      expect(await screen.findByTestId('toast')).toHaveTextContent(
        'Save message to template folder successfully'
      )
      expect(templatesOf(jmapServer)).toEqual([
        expect.objectContaining({
          subject: 'test subject',
          keywords: { $seen: true }
        })
      ])
      const [first] = templatesOf(jmapServer)

      await userEvent.click(
        within(composer).getByRole('textbox', { name: 'Subject' })
      )
      await userEvent.keyboard('{End}')
      await userEvent.paste(' updated')
      await saveAsTemplate(composer)

      await waitFor(() => {
        expect(screen.getByTestId('toast')).toHaveTextContent(
          'Update message to template folder successfully'
        )
      })
      await waitFor(() => {
        expect(templatesOf(jmapServer).map(email => email.subject)).toEqual([
          'test subject updated'
        ])
      })
      expect(templatesOf(jmapServer)[0]?.id).not.toBe(first?.id)
      expect(
        jmapServer.mailboxes.filter(mailbox => mailbox.name === 'Templates')
      ).toHaveLength(1)
      // Kept as a template: no draft left, closing asks nothing
      expect(draftsOf(jmapServer)).toEqual([])
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Save & close' })
      )
      await waitFor(() => {
        expect(screen.queryByTestId('composer')).toBe(null)
      })
      expect(draftsOf(jmapServer)).toEqual([])
    })

    it('opens a template as a new message that saving as template updates', async () => {
      const templates = makeMailbox({
        id: 'mailbox-templates',
        name: 'Templates'
      })
      const jmapServer = makeFakeJmapServer({
        mailboxes: [...makeDefaultMailboxes(), templates],
        emails: [
          makeEmailWithBody(
            {
              id: 'template-1',
              mailboxIds: { 'mailbox-templates': true },
              keywords: { $seen: true },
              subject: 'Weekly report',
              to: [{ name: null, email: 'team@example.com' }]
            },
            { html: '<div>Done this week:</div>' }
          )
        ]
      })
      renderComposer(jmapServer)
      const composer = await openComposer('Open template')

      expect(
        within(composer).getByRole('textbox', { name: 'Subject' })
      ).toHaveValue('Weekly report')
      expect(
        within(composer).getByRole('textbox', { name: 'Message body' })
      ).toHaveTextContent('Done this week:')
      await saveAsTemplate(composer)

      expect(await screen.findByTestId('toast')).toHaveTextContent(
        'Update message to template folder successfully'
      )
      await waitFor(() => {
        expect(templatesOf(jmapServer)).toHaveLength(1)
      })
      expect(templatesOf(jmapServer)[0]?.id).not.toBe('template-1')
    })

    describe('as a team mailbox', () => {
      function makeTeamServer(
        options: Parameters<typeof makeTeamMailboxes>[0] = {},
        without: string[] = []
      ): FakeJmapServer {
        return makeFakeJmapServer({
          mailboxes: [
            ...makeDefaultMailboxes(),
            ...makeTeamMailboxes(options).filter(
              mailbox => !without.includes(mailbox.id)
            )
          ],
          identities: [
            makeIdentity({ id: 'identity-alice', mayDelete: false }),
            makeIdentity({
              id: 'identity-team',
              name: 'Team',
              email: 'team@example.com'
            })
          ]
        })
      }

      async function chooseTeam(composer: HTMLElement): Promise<void> {
        await showFrom(composer)
        await userEvent.click(
          within(composer).getByTestId('composer-identity-select')
        )
        await userEvent.click(screen.getByRole('option', { name: /^Team/ }))
      }

      it('files the template in the Templates of the team mailbox of the identity', async () => {
        const jmapServer = makeTeamServer()
        renderComposer(jmapServer)
        const composer = await openComposer()
        await chooseTeam(composer)
        await fill(composer, { subject: 'Team template' })

        await saveAsTemplate(composer)

        expect(await screen.findByTestId('toast')).toHaveTextContent(
          'Save message to template folder successfully'
        )
        expect(
          jmapServer.emails.map(email => [email.subject, email.mailboxIds])
        ).toEqual([['Team template', { 'team-templates': true }]])
      })

      it('creates the Templates of the team mailbox under its root when it has none', async () => {
        const jmapServer = makeTeamServer({}, ['team-templates'])
        renderComposer(jmapServer)
        const composer = await openComposer()
        await chooseTeam(composer)
        await fill(composer, { subject: 'Team template' })

        await saveAsTemplate(composer)

        await screen.findByTestId('toast')
        const created = jmapServer.mailboxes.filter(
          mailbox => mailbox.name === 'Templates'
        )
        expect(created).toEqual([
          expect.objectContaining({
            parentId: 'team',
            namespace: expect.any(String)
          })
        ])
        expect(jmapServer.emails[0]?.mailboxIds).toEqual({
          [created[0]?.id ?? '']: true
        })
      })

      it('keeps the template in the own Templates when the rights do not allow the team ones', async () => {
        const jmapServer = makeTeamServer({
          rights: { mayAddItems: false, mayCreateChild: false }
        })
        renderComposer(jmapServer)
        const composer = await openComposer()
        await chooseTeam(composer)
        await fill(composer, { subject: 'Mine' })

        await saveAsTemplate(composer)

        await screen.findByTestId('toast')
        const own = jmapServer.mailboxes.find(
          mailbox => mailbox.name === 'Templates' && mailbox.parentId === null
        )
        expect(own).not.toBe(undefined)
        expect(jmapServer.emails[0]?.mailboxIds).toEqual({
          [own?.id ?? '']: true
        })
      })
    })

    describe('saved from a reopened draft', () => {
      function serverWithDraftIn(mailboxId: string): FakeJmapServer {
        return makeFakeJmapServer({
          mailboxes: [...makeDefaultMailboxes(), ...makeTeamMailboxes()],
          emails: [
            makeEmailWithBody(
              {
                id: 'draft-1',
                mailboxIds: { [mailboxId]: true },
                keywords: { $draft: true, $seen: true },
                subject: 'Reopened'
              },
              { html: '<div>Body</div>' }
            )
          ]
        })
      }

      /** The emails kept as templates: neither drafts nor the opened one */
      function savedTemplates(server: FakeJmapServer): typeof server.emails {
        return server.emails.filter(email => email.keywords.$draft !== true)
      }

      it('destroys the draft it was opened on', async () => {
        const jmapServer = serverWithDraftIn('mailbox-drafts')
        renderComposer(jmapServer)
        const composer = await openComposer('Open draft')
        await screen.findByDisplayValue('Reopened')

        await saveAsTemplate(composer)

        expect(await screen.findByTestId('toast')).toHaveTextContent(
          'Save message to template folder successfully'
        )
        await waitFor(() => {
          expect(draftsOf(jmapServer)).toEqual([])
        })
        expect(savedTemplates(jmapServer).map(email => email.subject)).toEqual([
          'Reopened'
        ])
      })

      it('asks before destroying a draft of a team mailbox, and destroys it when told to', async () => {
        const jmapServer = serverWithDraftIn('team-drafts')
        renderComposer(jmapServer)
        const composer = await openComposer('Open draft')
        await screen.findByDisplayValue('Reopened')

        await saveAsTemplate(composer)
        const dialog = await screen.findByRole('dialog', {
          name: 'Delete the shared draft?'
        })
        expect(savedTemplates(jmapServer)).toEqual([])
        await userEvent.click(
          within(dialog).getByRole('button', {
            name: 'Save and delete the draft'
          })
        )

        await waitFor(() => {
          expect(
            jmapServer.emails.filter(email => 'team-drafts' in email.mailboxIds)
          ).toEqual([])
        })
        expect(savedTemplates(jmapServer)).toHaveLength(1)
      })

      it('keeps the shared draft when told to', async () => {
        const jmapServer = serverWithDraftIn('team-drafts')
        renderComposer(jmapServer)
        const composer = await openComposer('Open draft')
        await screen.findByDisplayValue('Reopened')

        await saveAsTemplate(composer)
        await userEvent.click(
          await screen.findByRole('button', { name: 'Save and keep the draft' })
        )

        await waitFor(() => {
          expect(savedTemplates(jmapServer)).toHaveLength(1)
        })
        expect(
          jmapServer.emails.filter(email => 'team-drafts' in email.mailboxIds)
        ).toHaveLength(1)
      })

      it('saves nothing when the question is cancelled', async () => {
        const jmapServer = serverWithDraftIn('team-drafts')
        renderComposer(jmapServer)
        const composer = await openComposer('Open draft')
        await screen.findByDisplayValue('Reopened')

        await saveAsTemplate(composer)
        await userEvent.click(
          await screen.findByRole('button', { name: 'Cancel' })
        )

        await waitFor(() => {
          expect(
            screen.queryByRole('dialog', { name: 'Delete the shared draft?' })
          ).toBe(null)
        })
        expect(savedTemplates(jmapServer)).toEqual([])
        expect(jmapServer.emails).toHaveLength(1)
      })
    })

    describe('insert template', () => {
      function serverWithTemplates(): FakeJmapServer {
        return makeFakeJmapServer({
          mailboxes: [
            ...makeDefaultMailboxes(),
            makeMailbox({ id: 'mailbox-templates', name: 'Templates' }),
            ...makeTeamMailboxes()
          ],
          emails: [
            makeEmailWithBody(
              {
                id: 'template-1',
                mailboxIds: { 'mailbox-templates': true },
                keywords: { $seen: true },
                subject: 'Weekly report',
                preview: 'Done this week'
              },
              { html: '<div>Done this week:</div>' }
            ),
            makeEmailWithBody(
              {
                id: 'template-2',
                mailboxIds: { 'team-templates': true },
                keywords: { $seen: true },
                subject: 'Welcome aboard',
                preview: 'Glad to have you'
              },
              { html: '<div>Glad to have you</div>' }
            )
          ]
        })
      }

      async function openPicker(composer: HTMLElement): Promise<HTMLElement> {
        await userEvent.click(
          within(composer).getByRole('button', { name: 'More' })
        )
        await userEvent.click(
          screen.getByRole('menuitem', { name: 'Insert template' })
        )
        return screen.findByRole('dialog', { name: 'Insert a template' })
      }

      it('lists the templates of the user and of the team mailboxes, filterable and announcing the results', async () => {
        renderComposer(serverWithTemplates())
        const composer = await openComposer()
        const picker = await openPicker(composer)

        const field = await within(picker).findByRole('combobox', {
          name: 'Search templates'
        })
        expect(field).toHaveFocus()
        expect(
          within(picker)
            .getAllByRole('option')
            .map(option => option.textContent)
            .sort()
        ).toEqual([
          expect.stringContaining('Weekly report'),
          expect.stringContaining('Welcome aboard')
        ])

        await userEvent.type(field, 'welc')

        expect(within(picker).getAllByRole('option')).toHaveLength(1)
        expect(within(picker).getByRole('status')).toHaveTextContent(
          '1 template found'
        )
      })

      it('inserts the subject and the body of the template, with the keyboard, into an empty message', async () => {
        renderComposer(serverWithTemplates())
        const composer = await openComposer()
        const picker = await openPicker(composer)
        const field = await within(picker).findByRole('combobox', {
          name: 'Search templates'
        })
        await userEvent.type(field, 'weekly')

        await userEvent.keyboard('{Enter}')

        await waitFor(() => {
          expect(
            within(composer).getByRole('textbox', { name: 'Subject' })
          ).toHaveValue('Weekly report')
        })
        expect(
          within(composer).getByRole('textbox', { name: 'Message body' })
        ).toHaveTextContent('Done this week:')
        expect(
          screen.queryByRole('dialog', { name: 'Insert a template' })
        ).toBe(null)
        expect(
          within(composer).getByRole('textbox', { name: 'Message body' })
        ).toHaveFocus()
      })

      it('asks to insert or replace when the message is not empty', async () => {
        renderComposer(serverWithTemplates())
        const composer = await openComposer()
        await fill(composer, { subject: 'My own subject' })
        let picker = await openPicker(composer)
        await userEvent.click(
          await within(picker).findByRole('option', { name: /Weekly report/ })
        )

        await userEvent.click(
          await screen.findByRole('button', { name: 'Insert at the cursor' })
        )

        await waitFor(() => {
          expect(
            within(composer).getByRole('textbox', { name: 'Message body' })
          ).toHaveTextContent('Done this week:')
        })
        // The subject of a message that has one stays
        expect(
          within(composer).getByRole('textbox', { name: 'Subject' })
        ).toHaveValue('My own subject')

        picker = await openPicker(composer)
        await userEvent.click(
          await within(picker).findByRole('option', { name: /Welcome aboard/ })
        )
        await userEvent.click(
          await screen.findByRole('button', { name: 'Replace the message' })
        )

        await waitFor(() => {
          expect(
            within(composer).getByRole('textbox', { name: 'Subject' })
          ).toHaveValue('Welcome aboard')
        })
        const body = within(composer).getByRole('textbox', {
          name: 'Message body'
        })
        expect(body).toHaveTextContent('Glad to have you')
        expect(body).not.toHaveTextContent('Done this week:')
      })

      it('says there is no template yet', async () => {
        renderComposer()
        const composer = await openComposer()
        const picker = await openPicker(composer)

        expect(
          await within(picker).findByTestId('template-picker-none')
        ).toBeVisible()
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

    function serverWithAlias(): FakeJmapServer {
      const jmapServer = serverWithSource()
      jmapServer.identities.push(
        makeIdentity({
          id: 'identity-sales',
          name: 'Sales',
          email: 'sales@example.com',
          mayDelete: true,
          textSignature: 'The sales team',
          bcc: [{ name: null, email: 'crm@example.com' }]
        })
      )
      // Sent to the alias (not to the address of the account), Bob in To
      const source = jmapServer.emails[0]
      if (source) {
        source.to = [{ name: null, email: 'bob@example.com' }]
        source.cc = [{ name: null, email: 'SALES@example.com' }]
      }
      return jmapServer
    }

    it.each(['reply', 'replyAll', 'forward'])(
      'answers (%s) from the alias the email was sent to, with its signature',
      async action => {
        renderComposer(serverWithAlias())

        const composer = await openComposer(`Answer ${action}`)

        expect(
          within(composer).getByTestId('composer-identity-select')
        ).toHaveTextContent('Sales')
        expect(
          within(composer).getByRole('textbox', { name: 'Message body' })
        ).toHaveTextContent('The sales team')
      }
    )

    it('sends the answer from the alias, with its Bcc', async () => {
      const jmapServer = serverWithAlias()
      renderComposer(jmapServer)
      const composer = await openComposer('Answer reply')

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )

      expect(await screen.findByTestId('toast')).toHaveTextContent(
        'Message has been sent successfully'
      )
      const sent = jmapServer.emails.find(
        email => email.id === jmapServer.submitted[0]
      )
      expect(sent?.bcc).toEqual([{ name: null, email: 'crm@example.com' }])
      expect(sent?.from?.[0]?.email).toBe('sales@example.com')
    })

    it('answers an email of a team mailbox from its identity', async () => {
      const jmapServer = serverWithSource()
      const namespace = 'TeamMailbox[team@example.com]'
      jmapServer.mailboxes.push(
        makeMailbox({ id: 'team', name: 'team', namespace }),
        makeMailbox({
          id: 'team-inbox',
          name: 'INBOX',
          parentId: 'team',
          namespace
        })
      )
      jmapServer.identities.push(
        makeIdentity({
          id: 'identity-team',
          name: 'Team',
          email: 'team@example.com',
          mayDelete: true
        })
      )
      const source = jmapServer.emails[0]
      if (source) source.mailboxIds = { 'team-inbox': true }
      renderComposer(jmapServer)

      const composer = await openComposer('Answer reply')

      expect(
        within(composer).getByTestId('composer-identity-select')
      ).toHaveTextContent('Team')
    })

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

    it('marks the email a reply reopened from Drafts answers, once sent', async () => {
      const jmapServer = serverWithSource()
      renderComposer(jmapServer)
      const composer = await openComposer('Answer reply')
      await userEvent.click(
        within(composer).getByRole('button', { name: 'More' })
      )
      await userEvent.click(
        screen.getByRole('menuitem', { name: 'Save as draft' })
      )
      await waitFor(() => {
        expect(draftsOf(jmapServer)).toHaveLength(1)
      })
      const [draft] = draftsOf(jmapServer)
      expect(draft?.headers?.['X-Twake-Answering']).toBe('$answered source-1')
      await userEvent.click(
        within(composer).getByRole('button', { name: 'Save & close' })
      )
      await waitFor(() => {
        expect(screen.queryByTestId('composer')).toBe(null)
      })
      // Reopened from Drafts, by another composer
      jmapServer.emails = jmapServer.emails.map(email =>
        email.id === draft?.id ? { ...email, id: 'draft-1' } : email
      )

      const reopened = await openComposer('Open draft')
      await userEvent.click(
        within(reopened).getByRole('button', { name: 'Send' })
      )

      await waitFor(() => {
        expect(
          jmapServer.emails.find(email => email.id === 'source-1')?.keywords
        ).toEqual({ $answered: true })
      })
      const sent = jmapServer.emails.find(
        email => email.id === jmapServer.submitted[0]
      )
      expect(sent?.inReplyTo).toEqual(['plans@example.com'])
      expect(sent?.headers?.['X-Twake-Answering']).toBeUndefined()
    })

    describe('back after a reload', () => {
      async function restoreReply(
        opensOn: ComposerSnapshot['opensOn']
      ): Promise<void> {
        const snapshot: ComposerSnapshot = {
          identityId: 'identity-alice',
          recipients: {
            to: [{ name: 'Emma', email: 'emma@example.com' }],
            cc: [],
            bcc: [],
            replyTo: []
          },
          shown: [],
          subject: 'Re: Plans',
          html: '<p>Started answer</p>',
          images: [],
          attachments: [],
          // Its autosave ran
          draftId: 'draft-1',
          savedFingerprint: null,
          answering: { emailId: 'source-1', keyword: '$answered' },
          ...(opensOn === undefined ? {} : { opensOn })
        }
        await keepComposer('Re: Plans', snapshot)
      }

      it('opens a saved answer on its text, the recipients folded, as it was left', async () => {
        await restoreReply('text')
        renderComposer(serverWithSource())

        const composer = await screen.findByRole('dialog', {
          name: 'Re: Plans'
        })
        await waitFor(() => {
          expect(
            within(composer).getByRole('textbox', { name: 'Message body' })
          ).toHaveFocus()
        })
        expect(
          within(composer).getByTestId('composer-recipients-summary')
        ).toBeVisible()
        expect(within(composer).queryByRole('combobox', { name: 'To' })).toBe(
          null
        )
      })

      it('opens in To when it was left there', async () => {
        await restoreReply('recipients')
        renderComposer(serverWithSource())

        const composer = await screen.findByRole('dialog', {
          name: 'Re: Plans'
        })
        await waitFor(() => {
          expect(
            within(composer).getByRole('combobox', { name: 'To' })
          ).toHaveFocus()
        })
      })

      it('keeps where an answer opens in what the browser keeps', async () => {
        renderComposer(serverWithSource())
        const composer = await openComposer('Answer reply')
        await userEvent.type(
          within(composer).getByRole('textbox', { name: 'Subject' }),
          '!'
        )

        // The page goes: written at once
        window.dispatchEvent(new Event('pagehide'))

        await waitFor(async () => {
          expect((await kept())[0]?.snapshot?.opensOn).toBe('text')
        })
      })
    })

    it('replies to all but the user, Cc kept', async () => {
      renderComposer(serverWithSource())
      const composer = await openComposer('Answer replyAll')
      // The editor takes the focus on the next frame, and folds the recipients
      await waitFor(() => {
        expect(document.activeElement?.getAttribute('role')).toBe('textbox')
      })

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

  describe('signature', () => {
    it('is a card under a "Signature" pill that folds it and unfolds it', async () => {
      renderComposer(
        makeFakeJmapServer({
          identities: [
            makeIdentity({
              id: 'identity-alice',
              mayDelete: false,
              textSignature: 'The sales team'
            })
          ]
        })
      )
      const composer = await openComposer()

      const pill = await within(composer).findByRole('button', {
        name: 'Signature'
      })
      expect(pill).toHaveAttribute('aria-expanded', 'true')
      const text = within(composer).getByText(/The sales team/)
      expect(text).toBeVisible()

      await userEvent.click(pill)
      expect(pill).toHaveAttribute('aria-expanded', 'false')
      expect(text).not.toBeVisible()

      await userEvent.click(pill)
      expect(text).toBeVisible()
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
