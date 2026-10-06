import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Outlet, Route, useParams } from 'react-router'

import { ComposerProvider } from '@common/features/composer/ComposerProvider'
import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import {
  makeBodyPart,
  makeDefaultMailboxes,
  makeEmailWithBody,
  makeFakeJmapServer,
  type FakeEmail,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { saveBlob } from '@common/utils/saveBlob'

import { EmailView } from './EmailView'
import { printHtmlDocument } from './printDocument'

jest.mock('@common/utils/saveBlob', () => ({ saveBlob: jest.fn() }))
jest.mock('./printDocument', () => ({
  ...jest.requireActual<object>('./printDocument'),
  printHtmlDocument: jest.fn().mockResolvedValue(undefined)
}))

function MailScreen(): ReactElement {
  return (
    <ComposerProvider>
      <MailboxPickerProvider>
        <Outlet />
      </MailboxPickerProvider>
    </ComposerProvider>
  )
}

function ViewPage(): ReactElement {
  const { mailboxId = '', emailId = '' } = useParams()
  return (
    <EmailView
      mailboxId={mailboxId}
      emailId={emailId}
      backPath={`/mailbox/${mailboxId}`}
    />
  )
}

function makeServer(overrides: Partial<FakeEmail> = {}): FakeJmapServer {
  const server = makeFakeJmapServer({
    mailboxes: makeDefaultMailboxes(),
    emails: [
      makeEmailWithBody(
        {
          id: 'e1',
          subject: 'Weekly: news / 2',
          keywords: { $seen: true },
          blobId: 'blob-e1',
          from: [{ name: 'News Letter', email: 'news@example.com' }],
          to: [{ name: 'Alice', email: 'alice@example.com' }],
          cc: [{ name: null, email: 'carol@example.com' }],
          attachments: [
            makeBodyPart({
              type: 'application/pdf',
              blobId: 'att-1',
              name: 'report.pdf',
              size: 2000,
              disposition: 'attachment'
            })
          ],
          ...overrides
        },
        { html: '<p>Hello <b>world</b></p><blockquote>quoted</blockquote>' }
      )
    ]
  })
  server.blobs.set('blob-e1', 'Subject: Weekly\r\n\r\nHello')
  return server
}

async function openEmail(server: FakeJmapServer): Promise<void> {
  renderWithProviders(<MailScreen />, {
    route: '/mailbox/mailbox-inbox/email/e1',
    path: '/',
    withJmapSession: true,
    jmapServer: server,
    childRoutes: (
      <Route path="mailbox/:mailboxId/email/:emailId" element={<ViewPage />} />
    )
  })
  await screen.findByTestId('email-view-subject')
}

async function openMoreMenu(): Promise<HTMLElement> {
  await userEvent.click(screen.getByTestId('email-view-more-button'))
  return screen.findByRole('menu', { name: 'Message actions' })
}

describe('actions of an open email', () => {
  listEmailsOneByOne()

  let openSpy: jest.SpyInstance

  beforeEach(() => {
    jest.mocked(saveBlob).mockClear()
    jest.mocked(printHtmlDocument).mockClear()
    openSpy = jest.spyOn(window, 'open').mockReturnValue(null)
  })

  afterEach(() => {
    openSpy.mockRestore()
  })

  describe('print', () => {
    it('prints the headers, the whole body and the attachments', async () => {
      await openEmail(makeServer())

      const menu = await openMoreMenu()
      await userEvent.click(
        within(menu).getByRole('menuitem', { name: 'Print all' })
      )

      await waitFor(() => {
        expect(printHtmlDocument).toHaveBeenCalledTimes(1)
      })
      const document = jest.mocked(printHtmlDocument).mock.calls[0]?.[0] ?? ''
      expect(document).toContain('<title>Twake Mail - Weekly: news / 2</title>')
      expect(document).toContain('News Letter')
      expect(document).toContain('&lt;news@example.com&gt;')
      expect(document).toContain('To: Alice &lt;alice@example.com&gt;')
      expect(document).toContain('Cc: carol@example.com')
      expect(document).toContain('<b>world</b>')
      expect(document).toContain('quoted')
      expect(document).toContain('1 attachment')
      expect(document).toContain('<b>report.pdf</b>')
      expect(document).toContain('alice@example.com')
    })

    it('keeps remote images out of the printed document', async () => {
      await openEmail(makeServer())
      const menu = await openMoreMenu()
      await userEvent.click(
        within(menu).getByRole('menuitem', { name: 'Print all' })
      )
      await waitFor(() => {
        expect(printHtmlDocument).toHaveBeenCalled()
      })
      expect(jest.mocked(printHtmlDocument).mock.calls[0]?.[0]).toContain(
        'img-src data: blob:;'
      )
    })
  })

  describe('download as EML', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    it('saves the blob of the email under the name of its subject', async () => {
      await openEmail(makeServer())
      const menu = await openMoreMenu()

      await userEvent.click(
        within(menu).getByRole('menuitem', {
          name: 'Download message as EML'
        })
      )

      await waitFor(() => {
        expect(saveBlob).toHaveBeenCalledTimes(1)
      })
      const [blob, name] = jest.mocked(saveBlob).mock.calls[0] ?? []
      expect(name).toBe('Weekly_ news _ 2.eml')
      expect(await blob?.text()).toBe('Subject: Weekly\r\n\r\nHello')
    })

    it('says so when the blob cannot be downloaded', async () => {
      const server = makeServer({ blobId: 'missing' })
      await openEmail(server)
      const menu = await openMoreMenu()

      await userEvent.click(
        within(menu).getByRole('menuitem', {
          name: 'Download message as EML'
        })
      )

      expect(
        await screen.findAllByText('Download message as EML failed')
      ).not.toHaveLength(0)
      expect(saveBlob).not.toHaveBeenCalled()
    })
  })

  describe('edit as new email', () => {
    it('opens a composer with the recipients, subject and body of the email', async () => {
      await openEmail(makeServer())
      const menu = await openMoreMenu()

      await userEvent.click(
        within(menu).getByRole('menuitem', { name: 'Edit as new email' })
      )

      const composer = await screen.findByRole('dialog', {
        name: 'Weekly: news / 2'
      })
      expect(
        await within(composer).findByRole('textbox', { name: 'Subject' })
      ).toHaveValue('Weekly: news / 2')
      expect(within(composer).getByText('Alice')).toBeVisible()
      expect(within(composer).getByText('carol@example.com')).toBeVisible()
      // Its files come along
      expect(await within(composer).findByText('report.pdf')).toBeVisible()
      expect(
        await within(composer).findByRole('textbox', { name: 'Message body' })
      ).toHaveTextContent('Hello world')
      // A new message: nothing was created on the server, the email is as it was
      expect(openSpy).not.toHaveBeenCalled()
    })
  })

  describe('unsubscribe', () => {
    const WEB_AND_MAIL = {
      headers: {
        'List-Unsubscribe':
          '<mailto:leave@example.com?subject=unsubscribe>, <https://example.com/u?id=1>'
      }
    }

    it('offers nothing without a List-Unsubscribe header', async () => {
      await openEmail(makeServer())
      expect(screen.queryByTestId('email-unsubscribe-link')).toBe(null)
      const menu = await openMoreMenu()
      expect(
        within(menu).queryByRole('menuitem', { name: 'Unsubscribe' })
      ).toBe(null)
    })

    it('ignores links that are neither web nor mailto', async () => {
      await openEmail(
        makeServer({
          headers: { 'List-Unsubscribe': '<javascript:alert(1)>, <ftp://x/y>' }
        })
      )
      expect(screen.queryByTestId('email-unsubscribe-link')).toBe(null)
    })

    it('asks first, and does nothing when the user declines', async () => {
      const server = makeServer(WEB_AND_MAIL)
      await openEmail(server)

      await userEvent.click(await screen.findByTestId('email-unsubscribe-link'))
      const dialog = await screen.findByRole('dialog', {
        name: 'Unsubscribe mail'
      })
      expect(dialog).toHaveTextContent(
        "Are you sure you'd like to stop receiving similar messages from News Letter ?"
      )
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Cancel' })
      )

      expect(openSpy).not.toHaveBeenCalled()
      expect(server.emails[0]?.keywords).toEqual({ $seen: true })
    })

    it('opens the web link of the sender in a new tab once confirmed, sets $unsubscribe and says so', async () => {
      const server = makeServer(WEB_AND_MAIL)
      await openEmail(server)

      await userEvent.click(await screen.findByTestId('email-unsubscribe-link'))
      const dialog = await screen.findByRole('dialog', {
        name: 'Unsubscribe mail'
      })
      // Nothing is fetched nor opened before the confirmation
      expect(openSpy).not.toHaveBeenCalled()
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Unsubscribe' })
      )

      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/u?id=1',
        '_blank',
        'noopener,noreferrer'
      )
      await waitFor(() => {
        expect(server.emails[0]?.keywords).toEqual({
          $seen: true,
          $unsubscribe: true
        })
      })
      expect(
        await screen.findAllByText('Unsubscribed from this mailing list')
      ).not.toHaveLength(0)
      expect(
        await screen.findByTestId('email-unsubscribed-banner')
      ).toHaveTextContent('You unsubscribe from News Letter')
      expect(screen.queryByTestId('email-unsubscribe-link')).toBe(null)
    })

    it('shows the banner of an email already unsubscribed, without the link', async () => {
      await openEmail(
        makeServer({
          ...WEB_AND_MAIL,
          keywords: { $seen: true, $unsubscribe: true }
        })
      )
      expect(
        await screen.findByTestId('email-unsubscribed-banner')
      ).toBeVisible()
      expect(screen.queryByTestId('email-unsubscribe-link')).toBe(null)
    })

    it('writes to the mailto address in the composer, and sets $unsubscribe once sent', async () => {
      const server = makeServer({
        headers: {
          'List-Unsubscribe': '<mailto:leave@example.com?subject=unsubscribe>'
        }
      })
      await openEmail(server)

      const menu = await openMoreMenu()
      await userEvent.click(
        within(menu).getByRole('menuitem', { name: 'Unsubscribe' })
      )
      const dialog = await screen.findByRole('dialog', {
        name: 'Unsubscribe mail'
      })
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Unsubscribe' })
      )

      const composer = await screen.findByRole('dialog', {
        name: 'unsubscribe'
      })
      expect(within(composer).getByText('leave@example.com')).toBeVisible()
      expect(openSpy).not.toHaveBeenCalled()
      // Not unsubscribed until the message is sent
      expect(server.emails[0]?.keywords).toEqual({ $seen: true })

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Send' })
      )
      await waitFor(() => {
        expect(server.emails[0]?.keywords).toEqual({
          $seen: true,
          $unsubscribe: true
        })
      })
    })
  })
})
