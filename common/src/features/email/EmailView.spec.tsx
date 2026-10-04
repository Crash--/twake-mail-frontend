import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'

import {
  makeBodyPart,
  makeEmail,
  makeEmailWithBody,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { readObjectUrl } from '@common/testing/objectUrls'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EMAIL_FRAME_SANDBOX } from './EmailBodyFrame'
import { EmailView } from './EmailView'
import { TRUSTED_SENDERS_STORAGE_KEY } from './trustedSenders'

const TRACKED_HTML =
  '<p>Newsletter</p><img src="https://tracker.example.com/open.gif" alt="">'

function renderView(
  jmapServer: FakeJmapServer,
  emailId = 'e1'
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <EmailView mailboxId="mailbox-inbox" emailId={emailId} />,
    {
      route: `/mailbox/mailbox-inbox/email/${emailId}`,
      path: '/mailbox/:mailboxId/email/:emailId',
      withJmapSession: true,
      jmapServer,
      routes: <Route path="/mailbox/:mailboxId" element={<p>The list</p>} />
    }
  )
}

/** The document the body frame loads, from its blob: URL */
async function findBodyDocument(): Promise<string> {
  const frame = await screen.findByTestId('email-view-body')
  await waitFor(() => {
    expect(frame).toHaveAttribute('src')
  })
  return (await readObjectUrl(frame.getAttribute('src') ?? '')) ?? ''
}

describe('EmailView', () => {
  it('shows the headers of the email', async () => {
    renderView(
      makeFakeJmapServer({
        emails: [
          makeEmailWithBody(
            {
              id: 'e1',
              subject: 'Quarterly report',
              receivedAt: '2026-02-14T10:30:00Z',
              cc: [{ name: null, email: 'carol@example.com' }]
            },
            { text: 'Hello' }
          )
        ]
      })
    )

    expect(await screen.findByTestId('email-view-subject')).toHaveTextContent(
      'Quarterly report'
    )
    expect(screen.getByTestId('email-view-from')).toHaveTextContent(
      'Bob Dupont <bob@example.com>'
    )
    expect(screen.getByTestId('email-view-to')).toHaveTextContent(
      'To: Alice Martin <alice@example.com>'
    )
    expect(screen.getByTestId('email-view-cc')).toHaveTextContent(
      'Cc: carol@example.com'
    )
    expect(screen.getByTestId('email-view-date')).toHaveTextContent(
      'Saturday, February 14, 2026 at 10:30 AM'
    )
    expect(screen.queryByTestId('email-view-bcc')).toBe(null)
  })

  it('renders the sanitized body in an iframe that cannot run scripts', async () => {
    const server = makeFakeJmapServer({
      emails: [
        makeEmailWithBody(
          { id: 'e1' },
          {
            html: '<p>Hello <b>Alice</b></p><script>alert("XSSRobot")</script><img src="x" onerror="alert(1)">'
          }
        )
      ]
    })
    renderView(server)

    const frame = await screen.findByTestId('email-view-body')
    const document = await findBodyDocument()

    expect(frame).toHaveAttribute('sandbox', EMAIL_FRAME_SANDBOX)
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts')
    expect(document).toContain('<p>Hello <b>Alice</b></p>')
    expect(document).not.toMatch(/<script|XSSRobot|onerror/)
    const [request] = server.requests.filter(({ methodCalls }) =>
      methodCalls.some(([name]) => name === 'Email/get')
    )
    expect(request?.methodCalls[0]?.[1]).toEqual(
      expect.objectContaining({
        ids: ['e1'],
        fetchHTMLBodyValues: true,
        properties: expect.arrayContaining(['htmlBody', 'bodyValues'])
      })
    )
  })

  it('shows a plain text body as text', async () => {
    renderView(
      makeFakeJmapServer({
        emails: [
          makeEmailWithBody(
            { id: 'e1' },
            { text: 'Lorem <ipsum>\ndolor sit amet' }
          )
        ]
      })
    )

    expect(await findBodyDocument()).toContain(
      '<div class="tmail-plain-text">Lorem &lt;ipsum&gt;\ndolor sit amet</div>'
    )
  })

  it('downloads the inline images and frees them when closed', async () => {
    const createObjectURL = jest.spyOn(URL, 'createObjectURL')
    const revokeObjectURL = jest.spyOn(URL, 'revokeObjectURL')
    // The URL of the image, not of the body frame document
    const imageUrl = (): string | undefined => {
      const index = createObjectURL.mock.calls.findIndex(
        // Blobs of the Fetch API of Node, not of jsdom: no instanceof
        ([object]) => 'size' in object && object.type !== 'text/html'
      )
      const result: unknown = createObjectURL.mock.results[index]?.value
      return typeof result === 'string' ? result : undefined
    }
    const server = makeFakeJmapServer({
      emails: [
        makeEmailWithBody(
          {
            id: 'e1',
            attachments: [
              makeBodyPart({
                type: 'image/png',
                blobId: 'blob-logo',
                cid: '<logo@example.com>',
                disposition: 'inline',
                name: 'logo.png'
              })
            ]
          },
          { html: '<p>Our logo</p><img src="cid:logo@example.com">' }
        )
      ]
    })
    server.blobs.set('blob-logo', 'PNG')
    const { unmount } = renderView(server)

    await waitFor(async () => {
      expect(await findBodyDocument()).toContain(`<img src="${imageUrl()}">`)
    })
    expect(screen.queryByTestId('attachment-item')).toBe(null)

    unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith(imageUrl())
  })

  it('lists the attachments and downloads them', async () => {
    const createObjectURL = jest.spyOn(URL, 'createObjectURL')
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const server = makeFakeJmapServer({
      emails: [
        makeEmailWithBody(
          {
            id: 'e1',
            hasAttachment: true,
            attachments: [
              makeBodyPart({
                type: 'application/pdf',
                blobId: 'blob-report',
                name: 'report.pdf',
                size: 12_345,
                disposition: 'attachment'
              })
            ]
          },
          { text: 'See attached' }
        )
      ]
    })
    server.blobs.set('blob-report', '%PDF')
    renderView(server)

    const attachment = await screen.findByTestId('attachment-item')
    expect(attachment).toHaveTextContent('report.pdf (12.3 kB)')

    await userEvent.click(attachment)

    await waitFor(() => {
      expect(click).toHaveBeenCalledTimes(1)
    })
    // Blob of the Fetch API of Node, not of jsdom: check its content size
    expect(
      createObjectURL.mock.calls.map(([object]) =>
        'size' in object ? object.size : null
      )
    ).toContain(4)
  })

  it('goes back to the mailbox', async () => {
    renderView(
      makeFakeJmapServer({
        emails: [makeEmailWithBody({ id: 'e1' }, { text: 'Hello' })]
      })
    )

    await userEvent.click(await screen.findByTestId('email-view-back-button'))

    expect(screen.getByText('The list')).toBeVisible()
  })

  it('moves the focus to the subject when it opens', async () => {
    renderView(
      makeFakeJmapServer({
        emails: [
          makeEmailWithBody({ id: 'e1', subject: 'Focused' }, { text: 'Hi' })
        ]
      })
    )

    expect(await screen.findByTestId('email-view-subject')).toHaveFocus()
  })

  describe('remote content', () => {
    afterEach(() => {
      window.localStorage.clear()
    })

    it('hides remote images until the user shows them', async () => {
      renderView(
        makeFakeJmapServer({
          emails: [makeEmailWithBody({ id: 'e1' }, { html: TRACKED_HTML })]
        })
      )

      const banner = await screen.findByTestId('remote-content-banner')
      expect(banner).toHaveAttribute('role', 'status')
      expect(banner).toHaveTextContent('Remote images hidden')
      const blocked = await findBodyDocument()
      expect(blocked).toContain('<p>Newsletter</p>')
      expect(blocked).not.toContain('tracker.example.com')
      expect(blocked).toContain('img-src data: blob:;')

      await userEvent.click(screen.getByRole('button', { name: 'Show' }))

      expect(screen.queryByTestId('remote-content-banner')).toBe(null)
      await waitFor(async () => {
        expect(await findBodyDocument()).toContain(
          'src="https://tracker.example.com/open.gif"'
        )
      })
      expect(await findBodyDocument()).toContain('referrerpolicy="no-referrer"')
      expect(screen.getByTestId('email-view-subject')).toHaveFocus()
    })

    it('always shows the remote images of a trusted sender', async () => {
      const server = makeFakeJmapServer({
        emails: [
          makeEmailWithBody({ id: 'e1' }, { html: TRACKED_HTML }),
          makeEmailWithBody({ id: 'e2' }, { html: TRACKED_HTML })
        ]
      })
      const { unmount } = renderView(server)

      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Always show for this sender'
        })
      )
      expect(
        JSON.parse(
          window.localStorage.getItem(TRUSTED_SENDERS_STORAGE_KEY) ?? '[]'
        )
      ).toEqual(['bob@example.com'])
      unmount()

      renderView(server, 'e2')
      expect(await findBodyDocument()).toContain('tracker.example.com')
      expect(screen.queryByTestId('remote-content-banner')).toBe(null)
    })

    it('shows no banner for an email without remote content', async () => {
      renderView(
        makeFakeJmapServer({
          emails: [makeEmailWithBody({ id: 'e1' }, { html: '<p>Plain</p>' })]
        })
      )

      expect(await findBodyDocument()).toContain('<p>Plain</p>')
      expect(screen.queryByTestId('remote-content-banner')).toBe(null)
    })
  })

  it('says when the email does not exist', async () => {
    renderView(makeFakeJmapServer({ emails: [makeEmail({ id: 'other' })] }))

    expect(await screen.findByTestId('email-not-found')).toHaveTextContent(
      'This message no longer exists'
    )
  })
})
