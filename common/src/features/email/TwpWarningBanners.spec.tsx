import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'

import {
  makeDefaultMailboxes,
  makeEmailWithBody,
  makeFakeJmapServer,
  makeTeamMailboxes,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailView } from './EmailView'

function makeServer(
  headers: string[] | undefined,
  overrides: Parameters<typeof makeEmailWithBody>[0] = { id: 'e1' },
  mailboxes = makeDefaultMailboxes()
): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes,
    emails: [
      makeEmailWithBody(
        {
          subject: 'Quarterly report',
          ...overrides,
          headers: headers === undefined ? {} : { 'X-TWP-Message': headers }
        },
        { text: 'Hello' }
      )
    ]
  })
}

function renderView(
  server: FakeJmapServer,
  mailbox = 'mailbox-inbox'
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <EmailView emailId="e1" backPath={`/mailbox/${mailbox}`} />,
    {
      route: `/mailbox/${mailbox}/email/e1`,
      path: '/mailbox/:mailboxId/email/:emailId',
      withJmapSession: true,
      jmapServer: server,
      routes: <Route path="/mailbox/:mailboxId" element={<p>The list</p>} />
    }
  )
}

function keywordsOf(server: FakeJmapServer): Record<string, true> | undefined {
  return server.emails.find(email => email.id === 'e1')?.keywords
}

describe('TwpWarningBanners', () => {
  listEmailsOneByOne()

  it('asks the X-TWP-Message headers of the email, all of them', async () => {
    const server = makeServer(undefined)
    renderView(server)
    await screen.findByTestId('email-view-subject')

    const get = server.callsOf('Email/get')[0]
    expect(get?.properties).toContain('header:X-TWP-Message:asText:all')
  })

  it('shows nothing for an email without warning', async () => {
    renderView(makeServer(undefined))
    await screen.findByTestId('email-view-subject')

    expect(screen.queryByTestId('twp-warnings')).toBeNull()
    expect(screen.queryByTestId('email-view-danger-badge')).toBeNull()
  })

  it('shows the localized text of a known code, with its level in words', async () => {
    renderView(
      makeServer([
        'level:info code:suspicious-sender Text of the server, ignored'
      ])
    )

    const banner = await screen.findByTestId('twp-warning-0')
    expect(banner).toHaveAccessibleName('Information: About this message')
    expect(banner).toHaveTextContent(
      'This email is from an external sender immitating known users, double check the mail address.'
    )
    expect(banner).not.toHaveTextContent('ignored')
  })

  it('stacks one banner per header, in order, between the header and the body', async () => {
    renderView(
      makeServer([
        'level:warn code:virus',
        'level:error code:virus-removed',
        'level:info A third one'
      ])
    )

    const banners = await screen.findAllByTestId(/^twp-warning-\d$/)
    expect(banners.map(banner => banner.getAttribute('data-testid'))).toEqual([
      'twp-warning-0',
      'twp-warning-1',
      'twp-warning-2'
    ])
    expect(banners[0]).toHaveTextContent('This email is having virus')
    expect(banners[0]).toHaveAccessibleName(/^Warning: /)
    expect(banners[1]).toHaveAccessibleName(
      'Danger: This message may be dangerous'
    )
    const header = screen.getByTestId('email-view-from')
    const body = await screen.findByTestId('email-view-body')
    const container = screen.getByTestId('twp-warnings')
    expect(
      header.compareDocumentPosition(container) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      container.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('shows the text of the server of an unknown code as plain text', async () => {
    renderView(
      makeServer(['level:warn code:new-code <img src=x onerror=alert(1)> hi'])
    )

    const banner = await screen.findByTestId('twp-warning-0')
    expect(banner).toHaveTextContent('<img src=x onerror=alert(1)> hi')
    expect(banner.querySelector('img')).toBeNull()
    expect(banner.querySelector('a')).toBeNull()
  })

  it('caps a long text of the server', async () => {
    renderView(makeServer([`level:warn ${'x'.repeat(2000)}`]))

    const banner = await screen.findByTestId('twp-warning-0')
    expect(banner.textContent.length).toBeLessThan(700)
  })

  it('replaces the avatar by a badge for an error, not for a warn', async () => {
    renderView(makeServer(['level:error code:virus']))

    expect(
      await screen.findByRole('img', { name: 'Dangerous message' })
    ).toBeInTheDocument()
  })

  it('has no badge without error', async () => {
    renderView(makeServer(['level:warn code:virus']))
    await screen.findByTestId('twp-warning-0')

    expect(screen.queryByTestId('email-view-danger-badge')).toBeNull()
  })

  it('hides a dismissed warning at once and keeps it dismissed with a keyword by position', async () => {
    const server = makeServer(['level:warn A', 'level:warn B'])
    const release = server.holdRequests('Email/set')
    renderView(server)

    await userEvent.click(await screen.findByTestId('twp-warning-dismiss-1'))

    await waitFor(() => {
      expect(screen.queryByTestId('twp-warning-1')).toBeNull()
    })
    expect(screen.getByTestId('twp-warning-0')).toBeInTheDocument()
    release()
    await waitFor(() => {
      expect(keywordsOf(server)).toHaveProperty('twp-warning-dismissed-1', true)
    })
    expect(keywordsOf(server)).not.toHaveProperty('twp-warning-dismissed-0')
  })

  it('does not show a warning whose keyword is set, the others keep their position', async () => {
    renderView(
      makeServer(['level:warn A', 'level:warn B'], {
        id: 'e1',
        keywords: { 'twp-warning-dismissed-0': true }
      })
    )

    expect(await screen.findByTestId('twp-warning-1')).toBeInTheDocument()
    expect(screen.queryByTestId('twp-warning-0')).toBeNull()
    expect(screen.queryByTestId('email-view-danger-badge')).toBeNull()
  })

  it('puts the warning back when the server refuses the dismissal', async () => {
    const server = makeServer(['level:warn A'])
    server.setErrors.set('e1', 'forbidden')
    renderView(server)

    await userEvent.click(await screen.findByTestId('twp-warning-dismiss-0'))

    expect(
      (await screen.findAllByText('Unknown error occurred, please try again'))
        .length
    ).toBeGreaterThan(0)
    expect(screen.getByTestId('twp-warning-0')).toBeInTheDocument()
  })

  it('offers no dismissal in a mailbox where keywords cannot be set', async () => {
    renderView(
      makeServer(
        ['level:warn A'],
        { id: 'e1', mailboxIds: { 'team-inbox': true } },
        [
          ...makeDefaultMailboxes(),
          ...makeTeamMailboxes({ rights: { maySetKeywords: false } })
        ]
      ),
      'team-inbox'
    )

    expect(await screen.findByTestId('twp-warning-0')).toBeInTheDocument()
    expect(screen.queryByTestId('twp-warning-dismiss-0')).toBeNull()
  })

  it('offers Not spam for an error in Spam, and moves the email to the Inbox', async () => {
    const server = makeServer(['level:error code:virus'], {
      id: 'e1',
      mailboxIds: { 'mailbox-spam': true }
    })
    renderView(server, 'mailbox-spam')

    await userEvent.click(await screen.findByTestId('twp-warning-not-spam-0'))

    await waitFor(() => {
      expect(
        server.emails.find(email => email.id === 'e1')?.mailboxIds
      ).toEqual({ 'mailbox-inbox': true })
    })
  })

  it.each([
    ['an error in the Inbox', 'level:error', 'mailbox-inbox'],
    ['a warn in Spam', 'level:warn', 'mailbox-spam']
  ])('offers no Not spam for %s', async (_name, header, mailbox) => {
    renderView(
      makeServer([header], { id: 'e1', mailboxIds: { [mailbox]: true } }),
      mailbox
    )
    const banner = await screen.findByTestId('twp-warning-0')

    expect(
      within(banner).queryByRole('button', { name: 'Not spam' })
    ).toBeNull()
  })
})
