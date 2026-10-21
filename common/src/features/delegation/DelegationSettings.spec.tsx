import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  SETTINGS_SECTIONS,
  type SettingsSection
} from '@common/features/settings/sections'
import {
  FAKE_DELEGATION_CAPABILITIES,
  FAKE_TEAM_MAILBOXES_CAPABILITIES,
  installFakeDelegation,
  installFakeTeamMailboxRevoke
} from '@common/testing/fakeDelegation'
import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeTeamMailboxes,
  type FakeDelegatedAccount,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { DelegationSettings } from './DelegationSettings'

function delegationSection(): SettingsSection {
  const section = SETTINGS_SECTIONS.find(({ id }) => id === 'delegation')
  if (!section) throw new Error('No Delegation section')
  return section
}

function setup({
  delegates = [],
  delegatedAccounts = [],
  refused = [],
  teams = [],
  refusedTeams = []
}: {
  delegates?: string[]
  delegatedAccounts?: FakeDelegatedAccount[]
  refused?: string[]
  /** The addresses of the team mailboxes of the user */
  teams?: string[]
  /** The team mailboxes the server does not let them leave */
  refusedTeams?: string[]
} = {}): ReturnType<typeof installFakeDelegation> & {
  server: FakeJmapServer
} {
  const server = makeFakeJmapServer({
    capabilities: {
      ...FAKE_DELEGATION_CAPABILITIES,
      ...FAKE_TEAM_MAILBOXES_CAPABILITIES,
      'com:linagora:params:jmap:contact:autocomplete': { minInputLength: 1 }
    },
    mailboxes: [
      ...makeDefaultMailboxes(),
      ...teams.flatMap((address, index) =>
        makeTeamMailboxes({ id: `team-${index}`, address })
      )
    ],
    delegatedAccounts,
    contacts: [
      {
        id: 'c1',
        firstname: 'Bob',
        surname: 'Assistant',
        emailAddress: 'bob@example.com'
      },
      {
        // As tmail-backend lists a team mailbox among the domain contacts
        id: 'c3',
        firstname: 'bob-guests',
        surname: '',
        emailAddress: 'bob-guests@example.com'
      },
      {
        id: 'c2',
        firstname: 'Brenda',
        surname: 'Outside',
        emailAddress: 'brenda@other.org'
      }
    ]
  })
  const fake = installFakeDelegation(server, { delegates, refused })
  installFakeTeamMailboxRevoke(server, { refused: refusedTeams })
  renderWithProviders(<DelegationSettings section={delegationSection()} />, {
    jmapServer: server,
    withJmapSession: true
  })
  return { ...fake, server }
}

describe('DelegationSettings', () => {
  it('says no one has access yet, on the "My delegates" tab', async () => {
    setup()

    expect(await screen.findByText('No one has access yet')).toBeVisible()
    expect(
      screen.getByRole('tab', { name: 'My delegates', selected: true })
    ).toBeVisible()
    expect(
      screen.getByText(
        "Let others access your mailbox. They'll get an email when you add them."
      )
    ).toBeVisible()
  })

  it('lists the delegates by their contact name', async () => {
    setup({ delegates: ['bob@example.com', 'carol@example.com'] })

    const list = await screen.findByRole('list', {
      name: 'Who has access to me'
    })
    await waitFor(() => {
      expect(within(list).getByText('Bob Assistant')).toBeVisible()
    })
    expect(within(list).getByText('carol@example.com')).toBeVisible()
    expect(
      within(list).getAllByRole('button', { name: /^Remove the access of/ })
    ).toHaveLength(2)
  })

  it('suggests the people of the domain only, and adds them in one step', async () => {
    const fake = setup()

    await userEvent.click(await screen.findByTestId('delegation-add-button'))
    const dialog = screen.getByRole('dialog', { name: 'Delegate access' })
    expect(
      within(dialog).getByRole('combobox', { name: 'Email address' })
    ).toHaveFocus()
    const add = within(dialog).getByRole('button', { name: 'Add' })
    expect(add).toBeDisabled()

    await userEvent.type(
      within(dialog).getByRole('combobox', { name: 'Email address' }),
      'b'
    )
    const listbox = await screen.findByRole('listbox')
    const bob = await within(listbox).findByRole('option', {
      name: /Bob Assistant/
    })
    expect(
      within(listbox).queryByRole('option', { name: /Brenda Outside/ })
    ).toBe(null)
    await userEvent.click(bob)
    await userEvent.click(add)

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Bob Assistant has been added'
    )
    expect(fake.delegates()).toEqual(['bob@example.com'])
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    // Back on "+ Add", now under the list, not on the page
    await waitFor(() => {
      expect(screen.getByTestId('delegation-add-button')).toHaveFocus()
    })
    expect(
      await screen.findByRole('list', { name: 'Who has access to me' })
    ).toHaveTextContent('Bob Assistant')
  })

  it('refuses an address of another domain, and the user themselves', async () => {
    setup()

    await userEvent.click(await screen.findByTestId('delegation-add-button'))
    const dialog = screen.getByRole('dialog', { name: 'Delegate access' })
    const input = within(dialog).getByRole('combobox', {
      name: 'Email address'
    })
    await userEvent.type(input, 'brenda@other.org')

    expect(
      within(dialog).getByTestId('delegation-input-error')
    ).toHaveTextContent('Only people of example.com can be given access.')
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeDisabled()

    await userEvent.clear(input)
    await userEvent.type(input, 'alice@example.com')
    expect(
      within(dialog).getByTestId('delegation-input-error')
    ).toHaveTextContent('You already have access to your own mailbox.')
  })

  it('closes once some of the people are added, and says who could not be', async () => {
    const fake = setup({ refused: ['ghost@example.com'] })

    await userEvent.click(await screen.findByTestId('delegation-add-button'))
    const dialog = screen.getByRole('dialog', { name: 'Delegate access' })
    await userEvent.type(
      within(dialog).getByRole('combobox', { name: 'Email address' }),
      'carol@example.com, ghost@example.com,'
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(fake.delegates()).toEqual(['carol@example.com'])
    expect(
      screen
        .getAllByTestId('toast')
        .some(toast => toast.textContent.includes('ghost@example.com'))
    ).toBe(true)
  })

  it('stays open when no one could be added', async () => {
    setup({ refused: ['ghost@example.com'] })

    await userEvent.click(await screen.findByTestId('delegation-add-button'))
    const dialog = screen.getByRole('dialog', { name: 'Delegate access' })
    await userEvent.type(
      within(dialog).getByRole('combobox', { name: 'Email address' }),
      'ghost@example.com,'
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'ghost@example.com'
    )
    expect(
      screen.getByRole('dialog', { name: 'Delegate access' })
    ).toBeVisible()
  })

  it('gives the focus to the next delegate once one is removed', async () => {
    setup({ delegates: ['bob@example.com', 'carol@example.com'] })

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Remove the access of Bob Assistant'
      })
    )
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Remove delegate access?' })
      ).getByRole('button', { name: 'Remove access' })
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Remove the access of carol@example.com'
        })
      ).toHaveFocus()
    })
  })

  it('neither suggests nor accepts a team mailbox of the user', async () => {
    setup({ teams: ['bob-guests@example.com'] })

    await userEvent.click(await screen.findByTestId('delegation-add-button'))
    const dialog = screen.getByRole('dialog', { name: 'Delegate access' })
    const input = within(dialog).getByRole('combobox', {
      name: 'Email address'
    })
    await userEvent.type(input, 'bob')
    const listbox = await screen.findByRole('listbox')
    expect(
      await within(listbox).findByRole('option', { name: /Bob Assistant/ })
    ).toBeVisible()
    expect(within(listbox).queryByRole('option', { name: /bob-guests/ })).toBe(
      null
    )

    await userEvent.clear(input)
    await userEvent.type(input, 'bob-guests@example.com')
    expect(
      within(dialog).getByTestId('delegation-input-error')
    ).toHaveTextContent('A team mailbox cannot be given access.')
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('takes their access back from a delegate after a confirmation', async () => {
    const fake = setup({ delegates: ['bob@example.com'] })

    await userEvent.click(
      await screen.findByRole('button', { name: /^Remove the access of/ })
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Remove delegate access?'
    })
    expect(
      within(dialog).getByText(
        'bob@example.com will no longer be able to view or manage your inbox. You can add them again at any time.'
      )
    ).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove access' })
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      /has been removed$/
    )
    expect(fake.delegates()).toEqual([])
    expect(await screen.findByText('No one has access yet')).toBeVisible()
    // The last one gone: on "+ Add" of the empty card
    await waitFor(() => {
      expect(screen.getByTestId('delegation-add-button')).toHaveFocus()
    })
  })

  it('lists the mailboxes delegated to the user, and gives one up', async () => {
    const { server } = setup({
      delegatedAccounts: [
        { accountId: 'account-boss', name: 'boss@example.com' }
      ]
    })

    await userEvent.click(
      await screen.findByRole('tab', { name: 'Delegated to me' })
    )
    const list = await screen.findByRole('list', {
      name: 'Mailboxes delegated to me (1)'
    })
    expect(within(list).getByText('boss@example.com')).toBeVisible()

    await userEvent.click(
      within(list).getByRole('button', {
        name: 'Remove your access to the mailbox of boss@example.com'
      })
    )
    const dialog = screen.getByRole('dialog', { name: 'Remove your access?' })
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove access' })
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You no longer have access to the mailbox of boss@example.com'
    )
    expect(server.delegatedAccounts).toEqual([])
    expect(
      await screen.findByText('No mailboxes shared with you')
    ).toBeVisible()
  })

  it('lists the team mailboxes of the user under the delegated ones, and leaves one', async () => {
    const { server } = setup({
      delegatedAccounts: [
        { accountId: 'account-boss', name: 'boss@example.com' }
      ],
      teams: ['sales@example.com']
    })

    await userEvent.click(
      await screen.findByRole('tab', { name: 'Delegated to me' })
    )
    expect(
      await screen.findByRole('list', { name: 'Mailboxes delegated to me (1)' })
    ).toBeVisible()
    const list = await screen.findByRole('list', {
      name: 'Team mailboxes (1)'
    })
    expect(within(list).getByText('sales')).toBeVisible()
    expect(within(list).getByText('sales@example.com')).toBeVisible()

    await userEvent.click(
      within(list).getByRole('button', {
        name: 'Leave the team mailbox sales'
      })
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Leave this team mailbox?'
    })
    expect(
      within(dialog).getByText(
        "You'll no longer be able to view or manage sales@example.com. An administrator will need to add you again if you need it back."
      )
    ).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove access' })
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You left the team mailbox sales'
    )
    await waitFor(() => {
      expect(screen.queryByRole('list', { name: /^Team mailboxes/ })).toBe(null)
    })
    expect(
      server.mailboxes.some(mailbox => mailbox.namespace !== 'Personal')
    ).toBe(false)
    expect(
      screen.getByRole('list', { name: 'Mailboxes delegated to me (1)' })
    ).toBeVisible()
  })

  it('lists the team mailboxes alone, without delegated mailboxes', async () => {
    setup({ teams: ['sales@example.com'] })

    await userEvent.click(
      await screen.findByRole('tab', { name: 'Delegated to me' })
    )
    expect(
      await screen.findByRole('list', { name: 'Team mailboxes (1)' })
    ).toBeVisible()
    expect(screen.queryByText('No mailboxes shared with you')).toBe(null)
  })

  it('keeps the team mailbox when the server refuses to let the user leave it', async () => {
    setup({
      teams: ['sales@example.com'],
      refusedTeams: ['sales@example.com']
    })

    await userEvent.click(
      await screen.findByRole('tab', { name: 'Delegated to me' })
    )
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Leave the team mailbox sales'
      })
    )
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Leave this team mailbox?' })
      ).getByRole('button', { name: 'Remove access' })
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'The access could not be removed.'
    )
    // Still there, under the dialog kept open to try again
    expect(
      screen.getByRole('dialog', { name: 'Leave this team mailbox?' })
    ).toBeVisible()
    expect(
      screen.getByRole('list', { name: 'Team mailboxes (1)', hidden: true })
    ).toBeInTheDocument()
  })
})
