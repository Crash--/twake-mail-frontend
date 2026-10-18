import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import type { EmailBodyPart, EmailBodyValue } from 'jmap-client-ts'

import {
  makeBodyPart,
  makeEmail,
  makeFakeJmapServer,
  type FakeEmail,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'
import { readObjectUrl } from '@common/testing/objectUrls'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { saveBlob } from '@common/utils/saveBlob'

import { EmailView } from './EmailView'

jest.mock('@common/utils/saveBlob', () => ({ saveBlob: jest.fn() }))

function renderView(
  jmapServer: FakeJmapServer
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <EmailView emailId="e1" backPath="/mailbox/mailbox-inbox" />,
    {
      route: '/mailbox/mailbox-inbox/email/e1',
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

function value(
  text: string,
  flags: Partial<Omit<EmailBodyValue, 'value'>> = {}
): EmailBodyValue {
  return {
    value: text,
    isEncodingProblem: false,
    isTruncated: false,
    ...flags
  }
}

/** An email whose body has these parts, and the values the server gave */
function emailWith(
  htmlBody: EmailBodyPart[],
  bodyValues: Record<string, EmailBodyValue>,
  overrides: Partial<FakeEmail> = {}
): FakeEmail {
  return makeEmail({
    id: 'e1',
    subject: 'Quarterly report',
    blobId: 'blob-e1',
    htmlBody,
    bodyValues,
    ...overrides
  })
}

const HTML_PART = makeBodyPart({ partId: '1', type: 'text/html' })

describe('EmailMessageBody, when the server cannot give the body (tf#3487, #654)', () => {
  listEmailsOneByOne()

  beforeEach(() => {
    jest.mocked(saveBlob).mockClear()
  })

  it('says that the content could not be loaded, rather than an empty message, when a text part comes without value', async () => {
    renderView(makeFakeJmapServer({ emails: [emailWith([HTML_PART], {})] }))

    const alert = await screen.findByTestId('email-body-error')
    expect(alert).toHaveAttribute('role', 'alert')
    expect(alert).toHaveTextContent(
      'The content of this message could not be loaded.'
    )
    // The headers stay: who sent what
    expect(screen.getByTestId('email-view-subject')).toHaveTextContent(
      'Quarterly report'
    )
    expect(screen.queryByTestId('email-view-body')).toBe(null)
  })

  it('asks for the email again on Retry, and shows the body the server gives then', async () => {
    const server = makeFakeJmapServer({
      emails: [emailWith([HTML_PART], {})]
    })
    renderView(server)
    const retry = await screen.findByRole('button', { name: 'Retry' })
    const calls = server.callsOf('Email/get').length
    const [email] = server.emails
    if (email === undefined) throw new Error('no email')
    email.bodyValues = { '1': value('<p>The figures of the quarter</p>') }

    await userEvent.click(retry)

    expect(await findBodyDocument()).toContain(
      '<p>The figures of the quarter</p>'
    )
    expect(screen.queryByTestId('email-body-error')).toBe(null)
    expect(server.callsOf('Email/get').length).toBeGreaterThan(calls)
  })

  it('shows the parts it has under the alert when only some came without value', async () => {
    renderView(
      makeFakeJmapServer({
        emails: [
          emailWith(
            [HTML_PART, makeBodyPart({ partId: '2', type: 'text/plain' })],
            { '1': value('<p>First part</p>') }
          )
        ]
      })
    )

    expect(await screen.findByTestId('email-body-error')).toBeVisible()
    expect(await findBodyDocument()).toContain('<p>First part</p>')
  })

  it('does not take an image of the body, which has no value, for a failure', async () => {
    renderView(
      makeFakeJmapServer({
        emails: [
          emailWith(
            [
              HTML_PART,
              makeBodyPart({ partId: '2', type: 'image/png', blobId: 'img' })
            ],
            { '1': value('<p>Look at this</p>') }
          )
        ]
      })
    )

    expect(await findBodyDocument()).toContain('<p>Look at this</p>')
    expect(screen.queryByTestId('email-body-error')).toBe(null)
  })

  it('shows an email without body as it is, without an alert', async () => {
    renderView(makeFakeJmapServer({ emails: [emailWith([], {})] }))

    expect(await findBodyDocument()).toContain('<div id="tmail-content"></div>')
    expect(screen.queryByTestId('email-body-error')).toBe(null)
    expect(screen.queryByTestId('email-body-truncated')).toBe(null)
  })

  it('shows what it has of a cut body, says it is cut, and downloads the whole message', async () => {
    const server = makeFakeJmapServer({
      emails: [
        emailWith([HTML_PART], {
          '1': value('<p>The beginning of a long story</p>', {
            isTruncated: true
          })
        })
      ]
    })
    server.blobs.set('blob-e1', 'Subject: Quarterly report\r\n\r\nAll of it')
    renderView(server)

    expect(await findBodyDocument()).toContain(
      '<p>The beginning of a long story</p>'
    )
    const notice = screen.getByTestId('email-body-truncated')
    expect(notice).toHaveAttribute('role', 'status')
    expect(notice).toHaveTextContent(
      'This message is too long to be shown in full.'
    )
    expect(screen.queryByTestId('email-body-error')).toBe(null)

    await userEvent.click(
      screen.getByRole('button', { name: 'Download message as EML' })
    )

    await waitFor(() => {
      expect(saveBlob).toHaveBeenCalledTimes(1)
    })
    const [blob, name] = jest.mocked(saveBlob).mock.calls[0] ?? []
    expect(name).toBe('Quarterly report.eml')
    expect(await blob?.text()).toContain('All of it')
  })

  it('says a cut body is cut without a download when the email has no blob', async () => {
    renderView(
      makeFakeJmapServer({
        emails: [
          emailWith(
            [HTML_PART],
            { '1': value('<p>Partial</p>', { isTruncated: true }) },
            { blobId: undefined }
          )
        ]
      })
    )

    expect(await screen.findByTestId('email-body-truncated')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Download message as EML' })
    ).toBe(null)
  })

  it('shows a body with an encoding problem as the server decoded it', async () => {
    renderView(
      makeFakeJmapServer({
        emails: [
          emailWith([makeBodyPart({ partId: '1', type: 'text/plain' })], {
            '1': value('Caf\uFFFD cr\uFFFDme', { isEncodingProblem: true })
          })
        ]
      })
    )

    expect(await findBodyDocument()).toContain('Caf� cr�me')
    expect(screen.queryByTestId('email-body-error')).toBe(null)
    expect(screen.queryByTestId('email-body-truncated')).toBe(null)
  })
})
