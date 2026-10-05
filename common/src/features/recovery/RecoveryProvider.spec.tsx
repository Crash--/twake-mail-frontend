import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  FAKE_ACCOUNT_ID,
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeMailbox
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import {
  RecoveryBanner,
  RecoveryProvider,
  useRecovery
} from './RecoveryProvider'

function OpenButton(): React.ReactElement {
  const { open, isAvailable } = useRecovery()
  return (
    <button type="button" onClick={open} disabled={!isAvailable}>
      Recover
    </button>
  )
}

describe('RecoveryProvider', () => {
  it('starts a recovery, follows it and opens the Recovered folder', async () => {
    const server = makeFakeJmapServer({
      capabilities: {
        'com:linagora:params:jmap:messages:vault': {
          maxEmailRecoveryPerRequest: '5',
          restorationHorizon: '15 days'
        }
      },
      mailboxes: [
        ...makeDefaultMailboxes(),
        makeMailbox({
          id: 'restored',
          name: 'Restored-Messages',
          role: 'restored messages'
        })
      ]
    })
    let polls = 0
    server.handlers.set('EmailRecoveryAction/set', () => ({
      created: { recovery: { id: 'task-1' } }
    }))
    server.handlers.set('EmailRecoveryAction/get', () => {
      polls += 1
      return {
        list: [
          {
            id: 'task-1',
            status: polls < 2 ? 'inProgress' : 'completed',
            successfulRestoreCount: 2
          }
        ],
        notFound: []
      }
    })
    renderWithProviders(
      <RecoveryProvider pollIntervalMs={10}>
        <OpenButton />
        <RecoveryBanner />
      </RecoveryProvider>,
      { jmapServer: server, withJmapSession: true, routes: <></> }
    )

    await userEvent.click(
      await screen.findByRole('button', { name: 'Recover' })
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Recover deleted messages'
    })
    expect(dialog).toHaveTextContent(
      'You can recover messages deleted during the past 15 days'
    )
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Subject' }),
      'Invoice'
    )
    await userEvent.click(within(dialog).getByTestId('recovery-restore-button'))

    expect(await screen.findByTestId('recovery-banner')).toBeVisible()
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      '2 messages recovered'
    )
    expect(screen.getByTestId('recovery-open-button')).toBeVisible()
    expect(screen.queryByTestId('recovery-banner')).toBe(null)
    expect(server.callsOf('EmailRecoveryAction/set')).toEqual([
      {
        accountId: FAKE_ACCOUNT_ID,
        create: {
          recovery: { deletedAfter: expect.any(String), subject: 'Invoice' }
        }
      }
    ])
  })
})
