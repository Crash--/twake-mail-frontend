import { waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'

import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeMailbox,
  type FakeMailbox
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { InboxUnreadTitle } from './InboxUnreadTitle'

function Inbox(): ReactElement {
  useDocumentTitle('Inbox')
  return <InboxUnreadTitle />
}

function renderTitle(mailboxes: FakeMailbox[]): void {
  renderWithProviders(<Inbox />, {
    withJmapSession: true,
    jmapServer: makeFakeJmapServer({ mailboxes })
  })
}

describe('InboxUnreadTitle', () => {
  afterEach(() => {
    document.title = ''
  })

  it('puts the unread count of the Inbox, not of the other folders, before the title', async () => {
    renderTitle([
      ...makeDefaultMailboxes(),
      makeMailbox({ id: 'work', name: 'Work', unreadEmails: 4 })
    ])

    await waitFor(() => {
      expect(document.title).toBe('(2) Inbox - Twake Mail')
    })
  })

  it('says 999+ past 999 unread emails, as the sidebar', async () => {
    renderTitle([
      makeMailbox({
        id: 'mailbox-inbox',
        name: 'INBOX',
        role: 'inbox',
        unreadEmails: 1200
      })
    ])

    await waitFor(() => {
      expect(document.title).toBe('(999+) Inbox - Twake Mail')
    })
  })

  it('leaves the title alone when the Inbox has no unread email', async () => {
    const mailboxes = makeDefaultMailboxes().map(mailbox => ({
      ...mailbox,
      unreadEmails: 0
    }))
    renderTitle([
      ...mailboxes,
      makeMailbox({ id: 'work', name: 'Work', unreadEmails: 4 })
    ])

    // The session and the mailboxes are loaded: still no count
    await waitFor(() => {
      expect(document.title).toBe('Inbox - Twake Mail')
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(document.title).toBe('Inbox - Twake Mail')
  })
})
