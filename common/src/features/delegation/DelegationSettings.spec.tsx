import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  SETTINGS_SECTIONS,
  type SettingsSection
} from '@common/features/settings/sections'
import {
  FAKE_DELEGATION_CAPABILITIES,
  installFakeDelegation
} from '@common/testing/fakeDelegation'
import {
  makeFakeJmapServer,
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
  refused = []
}: {
  delegates?: string[]
  delegatedAccounts?: FakeDelegatedAccount[]
  refused?: string[]
} = {}): ReturnType<typeof installFakeDelegation> & {
  server: FakeJmapServer
} {
  const server = makeFakeJmapServer({
    capabilities: {
      ...FAKE_DELEGATION_CAPABILITIES,
      'com:linagora:params:jmap:contact:autocomplete': { minInputLength: 1 }
    },
    delegatedAccounts,
    contacts: [
      {
        id: 'c1',
        firstname: 'Bob',
        surname: 'Assistant',
        emailAddress: 'bob@example.com'
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

  it('suggests the people of the domain only, then adds them after a confirmation', async () => {
    const fake = setup()

    await userEvent.click(await screen.findByTestId('delegation-add-button'))
    const dialog = screen.getByRole('dialog', { name: 'Delegate access' })
    const next = within(dialog).getByRole('button', { name: 'Next' })
    expect(next).toBeDisabled()

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
    await userEvent.click(next)

    expect(
      within(dialog).getByText(
        'Give full access to your mailbox to this person?'
      )
    ).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Bob Assistant has been added'
    )
    expect(fake.delegates()).toEqual(['bob@example.com'])
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
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
    expect(within(dialog).getByRole('button', { name: 'Next' })).toBeDisabled()

    await userEvent.clear(input)
    await userEvent.type(input, 'alice@example.com')
    expect(
      within(dialog).getByTestId('delegation-input-error')
    ).toHaveTextContent('You already have access to your own mailbox.')
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
})
