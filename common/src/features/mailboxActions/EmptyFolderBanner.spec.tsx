import { VirtuosoMockContext } from '@linagora/twake-mui'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

import { EmailList } from '@common/features/thread/EmailList'
import {
  makeDefaultMailboxes,
  makeEmail,
  makeFakeJmapServer,
  makeMailbox,
  makeTeamMailboxes,
  teamNamespace,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'

function makeServer(
  role: 'trash' | 'junk',
  options: { clear?: boolean; subfolders?: boolean } = {}
): FakeJmapServer {
  const mailboxId = role === 'trash' ? 'mailbox-trash' : 'mailbox-spam'
  return makeFakeJmapServer({
    capabilities:
      options.clear === true
        ? { [LINAGORA_CAPABILITIES.mailboxClear]: {} }
        : {},
    mailboxes: [
      ...makeDefaultMailboxes().map(mailbox =>
        mailbox.id === mailboxId ? { ...mailbox, totalEmails: 2 } : mailbox
      ),
      ...(options.subfolders === true
        ? [
            makeMailbox({ id: 'old', name: 'Old', parentId: 'mailbox-trash' }),
            makeMailbox({ id: 'older', name: 'Older', parentId: 'old' })
          ]
        : [])
    ],
    emails: [
      makeEmail({ id: 'a', mailboxIds: { [mailboxId]: true } }),
      makeEmail({ id: 'b', mailboxIds: { [mailboxId]: true } }),
      makeEmail({ id: 'kept', mailboxIds: { 'mailbox-inbox': true } })
    ]
  })
}

function makeTeamServer(
  rights: { mayRemoveItems?: boolean } = {}
): FakeJmapServer {
  return makeFakeJmapServer({
    capabilities: { [LINAGORA_CAPABILITIES.mailboxClear]: {} },
    mailboxes: [
      ...makeDefaultMailboxes(),
      ...makeTeamMailboxes({ rights }).map(mailbox =>
        mailbox.id === 'team-trash' ? { ...mailbox, totalEmails: 2 } : mailbox
      ),
      makeMailbox({
        id: 'team-old',
        name: 'Old',
        parentId: 'team-trash',
        namespace: teamNamespace('team@example.com')
      })
    ],
    emails: [
      makeEmail({ id: 'a', mailboxIds: { 'team-trash': true } }),
      makeEmail({ id: 'b', mailboxIds: { 'team-trash': true } }),
      makeEmail({ id: 'kept', mailboxIds: { 'mailbox-inbox': true } })
    ]
  })
}

async function renderFolder(
  server: FakeJmapServer,
  mailboxId: string
): Promise<void> {
  renderWithProviders(
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 10_000, itemHeight: 56 }}
    >
      <EmailList mailboxId={mailboxId} />
    </VirtuosoMockContext.Provider>,
    {
      route: `/mailbox/${mailboxId}`,
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer: server
    }
  )
  await screen.findAllByTestId('email-list-item')
}

describe('EmptyFolderBanner', () => {
  listEmailsOneByOne()

  it('stays the same while emails are selected, so that the rows do not move (#294)', async () => {
    await renderFolder(makeServer('trash'), 'mailbox-trash')
    const banner = screen.getByTestId('empty-trash-banner')
    const checkboxes = screen.getAllByTestId('email-list-item-checkbox')

    await userEvent.click(checkboxes[0] ?? banner)
    expect(screen.getByTestId('empty-trash-banner')).toBe(banner)
    await userEvent.click(checkboxes[1] ?? banner)
    expect(screen.getByTestId('empty-trash-banner')).toBe(banner)
    expect(screen.getByText('2 selected')).toBeVisible()
  })

  it('empties the Trash with Mailbox/clear, and its subfolders, after a confirmation', async () => {
    const server = makeServer('trash', { clear: true, subfolders: true })
    await renderFolder(server, 'mailbox-trash')

    const banner = screen.getByTestId('empty-trash-banner')
    expect(banner).toHaveTextContent(
      'All messages in Trash will be deleted if you reach limited storage.'
    )
    await userEvent.click(
      within(banner).getByRole('button', { name: 'Empty trash now' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Empty Trash' })
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )

    expect(await screen.findByTestId('empty-thread-view')).toBeVisible()
    expect(server.emails.map(email => email.id)).toEqual(['kept'])
    expect(server.mailboxes.map(mailbox => mailbox.id)).not.toEqual(
      expect.arrayContaining(['old', 'older'])
    )
    // The deepest first
    const destroyed = server.requests.flatMap(({ methodCalls }) =>
      methodCalls
        .filter(([name]) => name === 'Mailbox/set')
        .map(([, args]) => args.destroy)
    )
    expect(destroyed).toEqual([['older'], ['old']])
    const clear = server.requests.find(({ methodCalls }) =>
      methodCalls.some(([name]) => name === 'Mailbox/clear')
    )
    expect(clear?.using).toEqual(
      expect.arrayContaining([
        'urn:ietf:params:jmap:mail',
        LINAGORA_CAPABILITIES.mailboxClear
      ])
    )
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Trash subfolders deleted'
    )
  })

  it('empties Spam a page at a time without Mailbox/clear', async () => {
    const server = makeServer('junk')
    await renderFolder(server, 'mailbox-spam')

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete all spam emails now' })
    )
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Empty Spam folder' })
      ).getByRole('button', { name: 'Delete all' })
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'All messages have been deleted forever'
    )
    expect(server.emails.map(email => email.id)).toEqual(['kept'])
    expect(server.calledMethods()).not.toContain('Mailbox/clear')
  })

  it('empties the Trash of a team mailbox by query, and its subfolders, as the Trash', async () => {
    const server = makeTeamServer()
    await renderFolder(server, 'team-trash')

    const banner = screen.getByTestId('empty-trash-banner')
    await userEvent.click(
      within(banner).getByRole('button', { name: 'Empty trash now' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Empty Trash' })
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Trash subfolders deleted'
    )
    expect(server.emails.map(email => email.id)).toEqual(['kept'])
    expect(server.mailboxes.map(mailbox => mailbox.id)).not.toContain(
      'team-old'
    )
    // Mailbox/clear is for the folders of the user
    expect(server.calledMethods()).not.toContain('Mailbox/clear')
  })

  it('shows no banner in the Trash of a team mailbox to who may not remove its emails', async () => {
    const server = makeTeamServer({ mayRemoveItems: false })
    await renderFolder(server, 'team-trash')

    expect(screen.queryByTestId('empty-trash-banner')).toBe(null)
  })

  it('leaves everything when cancelled, and tells about a failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const server = makeServer('trash', { clear: true })
    server.setErrors.set('mailbox-trash', 'forbidden')
    await renderFolder(server, 'mailbox-trash')
    const button = screen.getByRole('button', { name: 'Empty trash now' })

    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(server.calledMethods()).not.toContain('Mailbox/clear')

    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByTestId('toast')).toHaveTextContent(
        'Empty trash folder failed'
      )
    })
    expect(server.emails).toHaveLength(3)
    jest.restoreAllMocks()
  })

  it('shows no banner in a folder that cannot be emptied at once', async () => {
    const server = makeServer('trash')
    await renderFolder(server, 'mailbox-inbox')

    expect(screen.queryByTestId('empty-trash-banner')).toBe(null)
  })
})
