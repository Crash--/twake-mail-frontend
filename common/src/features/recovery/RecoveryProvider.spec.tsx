import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { formatDay } from '@common/features/search/searchFilter'
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
      'You can recover messages deleted within the last 15 days.'
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

  it('sends the custom ranges chosen, in UTC', async () => {
    // The fields take the days as tmail-flutter writes them, dd/mm/yyyy
    const asText = (day: string): string => day.split('-').reverse().join('/')
    const server = makeFakeJmapServer({
      capabilities: {
        'com:linagora:params:jmap:messages:vault': {
          maxEmailRecoveryPerRequest: '5',
          restorationHorizon: '15 days'
        }
      }
    })
    server.handlers.set('EmailRecoveryAction/set', () => ({
      created: { recovery: { id: 'task-1' } }
    }))
    server.handlers.set('EmailRecoveryAction/get', () => ({
      list: [{ id: 'task-1', status: 'inProgress', successfulRestoreCount: 0 }],
      notFound: []
    }))
    renderWithProviders(
      <RecoveryProvider pollIntervalMs={60_000}>
        <OpenButton />
      </RecoveryProvider>,
      { jmapServer: server, withJmapSession: true, routes: <></> }
    )
    const today = new Date()
    const daysAgo = (days: number): string =>
      formatDay(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - days)
      )

    await userEvent.click(
      await screen.findByRole('button', { name: 'Recover' })
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Recover deleted messages'
    })
    for (const [name, start, end] of [
      ['Deletion date', daysAgo(5), daysAgo(2)],
      ['Reception date', daysAgo(60), daysAgo(30)]
    ] as const) {
      await userEvent.click(within(dialog).getByRole('combobox', { name }))
      await userEvent.click(
        await screen.findByRole('option', { name: 'Custom range' })
      )
      const range = await screen.findByRole('dialog', { name: 'Custom range' })
      fireEvent.change(within(range).getByLabelText('Start date'), {
        target: { value: asText(start) }
      })
      fireEvent.change(within(range).getByLabelText('End date'), {
        target: { value: asText(end) }
      })
      await userEvent.click(
        within(range).getByRole('button', { name: 'Set date' })
      )
      expect(
        await within(dialog).findByRole('combobox', { name })
      ).toHaveTextContent(`From ${asText(start)} to ${asText(end)}`)
    }
    await userEvent.click(within(dialog).getByTestId('recovery-restore-button'))

    // Tests run in UTC: the local midnights are the UTC ones
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(server.callsOf('EmailRecoveryAction/set')).toEqual([
      {
        accountId: FAKE_ACCOUNT_ID,
        create: {
          recovery: {
            deletedAfter: `${daysAgo(5)}T00:00:00Z`,
            deletedBefore: `${daysAgo(1)}T00:00:00Z`,
            receivedAfter: `${daysAgo(60)}T00:00:00Z`,
            receivedBefore: `${daysAgo(29)}T00:00:00Z`
          }
        }
      }
    ])
  })
})
