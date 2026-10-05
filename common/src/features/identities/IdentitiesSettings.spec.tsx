import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  SETTINGS_SECTIONS,
  type SettingsSection
} from '@common/features/settings/sections'
import {
  makeFakeJmapServer,
  makeIdentity,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { IdentitiesSettings } from './IdentitiesSettings'

const SORT_ORDER = 'urn:apache:james:params:jmap:mail:identity:sortorder'
function profilesSection(): SettingsSection {
  const section = SETTINGS_SECTIONS.find(({ id }) => id === 'profiles')
  if (!section) throw new Error('No Profiles section')
  return section
}

function makeServer(withSortOrder = true): FakeJmapServer {
  return makeFakeJmapServer({
    capabilities: withSortOrder ? { [SORT_ORDER]: {} } : {},
    identities: [
      makeIdentity({
        id: 'server',
        name: 'Alice Martin',
        mayDelete: false,
        sortOrder: 100
      }),
      makeIdentity({
        id: 'work',
        name: 'Alice at work',
        mayDelete: true,
        sortOrder: 0,
        replyTo: [{ name: null, email: 'team@example.com' }],
        htmlSignature: '<p>Alice</p><p>CEO</p>'
      })
    ]
  })
}

function renderSettings(server: FakeJmapServer): void {
  renderWithProviders(<IdentitiesSettings section={profilesSection()} />, {
    jmapServer: server,
    withJmapSession: true
  })
}

function item(name: string): HTMLElement {
  const found = screen
    .getAllByTestId('identity-item')
    .find(element => element.dataset.identityName === name)
  if (!found) throw new Error(`No identity ${name}`)
  return found
}

describe('IdentitiesSettings', () => {
  it('lists the identities, the default one first and marked', async () => {
    renderSettings(makeServer())

    await screen.findByText('Alice at work')
    const items = screen.getAllByTestId('identity-item')
    expect(items.map(element => element.dataset.identityName)).toEqual([
      'Alice at work',
      'Alice Martin'
    ])
    const work = item('Alice at work')
    expect(within(work).getByText('Default')).toBeVisible()
    expect(within(work).getByText('Reply to: team@example.com')).toBeVisible()
    expect(within(work).getByText('-- Alice CEO')).toBeVisible()
    expect(
      within(work).getByRole('radio', { name: 'Use Alice at work by default' })
    ).toBeChecked()
    // The identity of the account cannot be deleted
    const server = item('Alice Martin')
    expect(within(server).queryByTestId('identity-delete-button')).toBe(null)
    expect(
      within(server).getByText(
        'Created with your account, it cannot be deleted'
      )
    ).toBeVisible()
  })

  it('makes another identity the default one', async () => {
    const server = makeServer()
    renderSettings(server)

    await userEvent.click(
      await screen.findByRole('radio', { name: 'Use Alice Martin by default' })
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Default identity setup successful'
    )
    const [args] = server.callsOf('Identity/set')
    expect(args?.update).toEqual({
      server: { sortOrder: 0 },
      work: { sortOrder: 100 }
    })
    expect(server.requests.at(-2)?.using).toContain(SORT_ORDER)
    await waitFor(() => {
      expect(
        screen.getAllByTestId('identity-item')[0]?.dataset.identityName
      ).toBe('Alice Martin')
    })
  })

  it('creates a default identity with its addresses', async () => {
    const server = makeServer()
    renderSettings(server)

    await userEvent.click(
      await screen.findByTestId('create-new-identity-button')
    )
    const dialog = screen.getByRole('dialog', { name: 'Create new identity' })
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Name' }),
      'Support'
    )
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Bcc to' }),
      'archive@example.com'
    )
    await userEvent.click(
      within(dialog).getByRole('checkbox', { name: 'Set as default identity' })
    )
    await userEvent.click(within(dialog).getByTestId('save-identity-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You have created a new default identity'
    )
    expect(screen.queryByRole('dialog')).toBe(null)
    const [args] = server.callsOf('Identity/set')
    expect(args).toMatchObject({
      create: {
        identity: {
          name: 'Support',
          email: 'alice@example.com',
          replyTo: [],
          bcc: [{ name: null, email: 'archive@example.com' }],
          htmlSignature: '',
          textSignature: '',
          sortOrder: 0
        }
      },
      update: { work: { sortOrder: 100 } }
    })
    await waitFor(() => {
      expect(
        screen.getAllByTestId('identity-item')[0]?.dataset.identityName
      ).toBe('Support')
    })
  })

  it('tells what is wrong with the form instead of saving', async () => {
    const server = makeServer()
    renderSettings(server)

    await userEvent.click(
      await screen.findByTestId('create-new-identity-button')
    )
    const dialog = screen.getByRole('dialog')
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Reply to' }),
      'not an address'
    )
    await userEvent.click(within(dialog).getByTestId('save-identity-button'))

    const name = within(dialog).getByRole('textbox', { name: 'Name' })
    expect(name).toHaveFocus()
    expect(name).toHaveAccessibleDescription('This field cannot be blank')
    expect(
      within(dialog).getByRole('textbox', { name: 'Reply to' })
    ).toHaveAccessibleDescription('This email address invalid')
    expect(server.callsOf('Identity/set')).toEqual([])
  })

  it('edits an identity without changing its address', async () => {
    const server = makeServer()
    renderSettings(server)

    await userEvent.click(
      within(await waitFor(() => item('Alice at work'))).getByRole('button', {
        name: 'Edit Alice at work'
      })
    )
    const dialog = screen.getByRole('dialog', { name: 'Edit identity' })
    expect(
      within(dialog).getByRole('combobox', { name: 'Email address' })
    ).toBeDisabled()
    const replyTo = within(dialog).getByRole('textbox', { name: 'Reply to' })
    expect(replyTo).toHaveValue('team@example.com')
    await userEvent.clear(replyTo)
    await userEvent.click(within(dialog).getByTestId('save-identity-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You’ve changed your identity successfully'
    )
    const [args] = server.callsOf('Identity/set')
    expect(args?.update).toEqual({
      work: {
        name: 'Alice at work',
        replyTo: [],
        bcc: [],
        htmlSignature: '<p>Alice</p><p>CEO</p>',
        textSignature: 'Alice\nCEO'
      }
    })
  })

  it('deletes an identity once confirmed', async () => {
    const server = makeServer()
    renderSettings(server)

    await userEvent.click(
      within(await waitFor(() => item('Alice at work'))).getByRole('button', {
        name: 'Delete Alice at work'
      })
    )
    const confirm = screen.getByRole('dialog', { name: 'Delete identity' })
    await userEvent.click(
      within(confirm).getByTestId('confirm-dialog-confirm-button')
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Identity has been deleted'
    )
    expect(server.callsOf('Identity/set')).toEqual([
      { accountId: 'account-alice', destroy: ['work'] }
    ])
    await waitFor(() => {
      expect(screen.getAllByTestId('identity-item')).toHaveLength(1)
    })
  })

  it('has no default identity to choose without the sort order extension', async () => {
    renderSettings(makeServer(false))

    await screen.findByText('Alice at work')
    expect(screen.queryByRole('radio')).toBe(null)
    expect(screen.queryByText('Default')).toBe(null)
    await userEvent.click(screen.getByTestId('create-new-identity-button'))
    expect(
      screen.queryByRole('checkbox', { name: 'Set as default identity' })
    ).toBe(null)
  })
})
