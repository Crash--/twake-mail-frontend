import { VirtuosoMockContext } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  makeEmail,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { StarredList } from './StarredList'

function renderStarred(server: FakeJmapServer): void {
  renderWithProviders(
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 10_000, itemHeight: 56 }}
    >
      <StarredList />
    </VirtuosoMockContext.Provider>,
    {
      route: '/starred',
      path: '/starred/*',
      withJmapSession: true,
      jmapServer: server
    }
  )
}

describe('StarredList', () => {
  it('lists the starred emails of every folder, and drops one unstarred', async () => {
    const server = makeFakeJmapServer({
      emails: [
        makeEmail({
          id: 'a',
          subject: 'Starred in Inbox',
          keywords: { $flagged: true }
        }),
        makeEmail({
          id: 'b',
          subject: 'Starred in Trash',
          mailboxIds: { 'mailbox-trash': true },
          keywords: { $flagged: true }
        }),
        makeEmail({ id: 'c', subject: 'Not starred' })
      ]
    })
    renderStarred(server)

    expect(await screen.findByText('Starred in Inbox')).toBeVisible()
    expect(screen.getByText('Starred in Trash')).toBeVisible()
    expect(screen.queryByText('Not starred')).toBe(null)
    expect(screen.getByRole('table', { name: 'Starred' })).toBeVisible()
    expect(document.title).toBe('Starred - Twake Mail')
  })

  it('shows the empty view without starred emails', async () => {
    renderStarred(makeFakeJmapServer({ emails: [makeEmail({ id: 'c' })] }))

    const empty = await screen.findByTestId('empty-thread-view')
    expect(empty).toBeVisible()
    expect(empty).toHaveTextContent('You don’t have any starred emails.')
    expect(empty).toHaveTextContent('Start to add starred emails')
  })

  it('links each row to the email, under /starred', async () => {
    renderStarred(
      makeFakeJmapServer({
        emails: [
          makeEmail({
            id: 'a',
            subject: 'Open me',
            keywords: { $flagged: true }
          })
        ]
      })
    )

    await userEvent.click(await screen.findByText('Open me'))

    expect(screen.getByRole('link', { name: /Open me/ })).toHaveAttribute(
      'href',
      '/starred/email/a'
    )
  })
})
