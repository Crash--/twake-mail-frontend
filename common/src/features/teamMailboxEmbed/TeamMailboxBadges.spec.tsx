import { act, waitFor } from '@testing-library/react'

import { patchMailboxes } from '@common/features/mailbox/patchMailboxes'
import {
  mailboxKeys,
  type MailboxListData
} from '@common/features/mailbox/queries'
import {
  FAKE_ACCOUNT_ID,
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeTeamMailboxes
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { TeamMailboxBadges } from './TeamMailboxBadges'

function makeServer(): ReturnType<typeof makeFakeJmapServer> {
  return makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      ...makeTeamMailboxes({ id: 'sales', address: 'sales@example.com' }).map(
        mailbox =>
          mailbox.id === 'sales-inbox'
            ? { ...mailbox, unreadEmails: 4 }
            : mailbox
      ),
      ...makeTeamMailboxes({ id: 'team', address: 'team@example.com' })
    ]
  })
}

describe('TeamMailboxBadges', () => {
  it('reports the unread emails of every team mailbox once the folders are loaded', async () => {
    const jmapServer = makeServer()
    const release = jmapServer.holdRequests('Mailbox/get')
    const reportBadges = jest.fn()
    renderWithProviders(<TeamMailboxBadges reportBadges={reportBadges} />, {
      withJmapSession: true,
      jmapServer
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    expect(reportBadges).not.toHaveBeenCalled()

    release()

    await waitFor(() => {
      expect(reportBadges).toHaveBeenCalledWith([
        { resourceId: 'sales', count: 4 },
        { resourceId: 'team', count: 0 }
      ])
    })
  })

  it('reports again when a count changes', async () => {
    const reportBadges = jest.fn()
    const { jmapServer, queryClient } = renderWithProviders(
      <TeamMailboxBadges reportBadges={reportBadges} />,
      { withJmapSession: true, jmapServer: makeServer() }
    )
    await waitFor(() => {
      expect(reportBadges).toHaveBeenCalledTimes(1)
    })

    const teamInbox = jmapServer.mailboxes.find(({ id }) => id === 'team-inbox')
    if (teamInbox === undefined) throw new Error('No team Inbox')
    teamInbox.unreadEmails = 2
    await act(async () => {
      await queryClient.invalidateQueries()
    })

    await waitFor(() => {
      expect(reportBadges).toHaveBeenLastCalledWith([
        { resourceId: 'sales', count: 4 },
        { resourceId: 'team', count: 2 }
      ])
    })
  })

  it('does not report again when the folders change but not the counts', async () => {
    const reportBadges = jest.fn()
    const { jmapServer, queryClient } = renderWithProviders(
      <TeamMailboxBadges reportBadges={reportBadges} />,
      { withJmapSession: true, jmapServer: makeServer() }
    )
    await waitFor(() => {
      expect(reportBadges).toHaveBeenCalledTimes(1)
    })

    const sent = jmapServer.mailboxes.find(({ id }) => id === 'team-sent')
    if (sent === undefined) throw new Error('No team Sent')
    sent.totalEmails = 12
    await act(async () => {
      await queryClient.invalidateQueries()
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    expect(reportBadges).toHaveBeenCalledTimes(1)
  })

  it('reports the count push brings', async () => {
    const reportBadges = jest.fn()
    const { queryClient } = renderWithProviders(
      <TeamMailboxBadges reportBadges={reportBadges} />,
      { withJmapSession: true, jmapServer: makeServer() }
    )
    await waitFor(() => {
      expect(reportBadges).toHaveBeenCalledTimes(1)
    })
    const key = mailboxKeys.list(FAKE_ACCOUNT_ID)
    const data = queryClient.getQueryData<MailboxListData>(key)
    const teamInbox = data?.list.find(({ id }) => id === 'team-inbox')
    if (data === undefined || teamInbox === undefined) {
      throw new Error('No team Inbox in the cache')
    }

    // What push does with the changes of Mailbox/changes
    act(() => {
      queryClient.setQueryData<MailboxListData>(key, current =>
        current === undefined
          ? current
          : patchMailboxes(current, {
              changed: [{ ...teamInbox, unreadEmails: 5 }],
              destroyed: [],
              oldState: current.state,
              newState: 'pushed'
            })
      )
    })

    await waitFor(() => {
      expect(reportBadges).toHaveBeenLastCalledWith([
        { resourceId: 'sales', count: 4 },
        { resourceId: 'team', count: 5 }
      ])
    })
    expect(reportBadges).toHaveBeenCalledTimes(2)
  })
})
