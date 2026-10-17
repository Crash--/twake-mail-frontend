import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Rule } from 'jmap-client-ts/linagora'

import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import {
  SETTINGS_SECTIONS,
  type SettingsSection
} from '@common/features/settings/sections'
import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeMailbox,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeFilter
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailRulesSettings } from './EmailRulesSettings'

function rulesSection(): SettingsSection {
  const section = SETTINGS_SECTIONS.find(({ id }) => id === 'email-rules')
  if (!section) throw new Error('No Email rules section')
  return section
}

const NEWSLETTERS: Rule = {
  name: 'Newsletters',
  conditionGroup: {
    conditionCombiner: 'AND',
    conditions: [{ field: 'from', comparator: 'contains', value: 'news@' }]
  },
  action: {
    appendIn: { mailboxIds: ['mailbox-archive'] },
    markAsSeen: true,
    markAsImportant: false,
    reject: false,
    withKeywords: []
  }
}

function setup(
  rules: Rule[] = [],
  state: unknown = null
): { server: FakeJmapServer; filter: ReturnType<typeof installFakeFilter> } {
  const server = makeFakeJmapServer({
    capabilities: FAKE_LINAGORA_CAPABILITIES
  })
  const filter = installFakeFilter(server, rules)
  renderWithProviders(<EmailRulesSettings section={rulesSection()} />, {
    jmapServer: server,
    withJmapSession: true,
    route: { pathname: '/settings/email-rules', state }
  })
  return { server, filter }
}

describe('EmailRulesSettings', () => {
  it('invites to create a first rule', async () => {
    setup()

    const empty = await screen.findByTestId('email-rules-empty')
    expect(empty).toHaveTextContent('No Rules Configured')
    await userEvent.click(
      within(empty).getByRole('button', { name: 'Create My First Rule' })
    )
    expect(
      screen.getByRole('dialog', { name: 'Create a New Rule' })
    ).toBeVisible()
  })

  it('lists the rules with their first condition', async () => {
    setup([NEWSLETTERS])

    const item = await screen.findByTestId('email-rule-item')
    expect(item).toHaveTextContent('Newsletters')
    expect(item).toHaveTextContent('From, contains: news@')
  })

  it('creates a rejecting rule from an address, once confirmed, at the top', async () => {
    const { filter } = setup([NEWSLETTERS], { newRuleFrom: 'spam@example.com' })

    const dialog = await screen.findByRole('dialog', {
      name: 'Create a New Rule'
    })
    expect(within(dialog).getByRole('textbox', { name: 'Value' })).toHaveValue(
      'spam@example.com'
    )
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Rule Name' }),
      'Reject rule'
    )
    await userEvent.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Action 1' }),
      'Reject it'
    )
    expect(
      within(dialog).queryByRole('button', { name: 'Add an action' })
    ).toBe(null)
    await userEvent.click(within(dialog).getByTestId('create-rule-button'))

    const warning = await screen.findByRole('dialog', {
      name: 'Reject all emails matching this condition?'
    })
    expect(warning).toHaveTextContent(
      'This action is irreversible. Are you sure you want to proceed?'
    )
    await userEvent.click(
      within(warning).getByRole('button', { name: 'Confirm' })
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'New filter was created'
    )
    expect(filter.rules()).toEqual([
      {
        name: 'Reject rule',
        conditionGroup: {
          conditionCombiner: 'AND',
          conditions: [
            { field: 'from', comparator: 'contains', value: 'spam@example.com' }
          ]
        },
        action: {
          appendIn: { mailboxIds: [] },
          markAsSeen: false,
          markAsImportant: false,
          reject: true,
          forwardTo: null
        }
      },
      NEWSLETTERS
    ])
    await waitFor(() => {
      expect(
        screen
          .getAllByTestId('email-rule-item')
          .map(item => item.dataset.ruleName)
      ).toEqual(['Reject rule', 'Newsletters'])
    })
  })

  it('tells what is missing instead of saving', async () => {
    const { server } = setup([NEWSLETTERS])

    await userEvent.click(await screen.findByTestId('add-rule-button'))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Rule Name' }),
      'Incomplete'
    )
    await userEvent.click(within(dialog).getByTestId('create-rule-button'))

    expect(
      within(dialog).getByRole('textbox', { name: 'Value' })
    ).toHaveAccessibleDescription('This field cannot be blank')

    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Value' }),
      'x'
    )
    await userEvent.click(within(dialog).getByTestId('create-rule-button'))

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'You have not added a action to the rule.'
    )
    expect(server.callsOf('Filter/set')).toEqual([])
  })

  it('says in words what the rule does once "Preview" is on', async () => {
    setup([NEWSLETTERS])

    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Newsletters' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Edit Rule' })
    const toggle = within(dialog).getByRole('button', { name: 'Preview' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).queryByTestId('rule-conditions-preview')).toBe(null)

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(dialog).getByTestId('rule-conditions-preview')
    ).toHaveTextContent('Preview: ALL of the conditions: From contains "news@"')
    expect(
      within(dialog).getByTestId('rule-actions-preview')
    ).toHaveTextContent(/^Preview: Actions: /)
  })

  it('edits a rule in place, adding conditions and actions', async () => {
    const { filter } = setup([NEWSLETTERS])

    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Newsletters' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Edit Rule' })
    await userEvent.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Conditions to meet' }),
      'Any'
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Add a condition' })
    )
    const second = within(dialog).getByRole('group', { name: 'Condition 2' })
    await userEvent.selectOptions(
      within(second).getByRole('combobox', { name: 'Field' }),
      'Subject'
    )
    await userEvent.type(
      within(second).getByRole('textbox', { name: 'Value' }),
      'weekly'
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Add an action' })
    )
    await userEvent.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Action 3' }),
      'Star it'
    )
    await userEvent.click(within(dialog).getByTestId('create-rule-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Your filter has been updated'
    )
    expect(filter.rules()).toEqual([
      {
        name: 'Newsletters',
        conditionGroup: {
          conditionCombiner: 'OR',
          conditions: [
            { field: 'from', comparator: 'contains', value: 'news@' },
            { field: 'subject', comparator: 'contains', value: 'weekly' }
          ]
        },
        action: {
          appendIn: { mailboxIds: ['mailbox-archive'] },
          markAsSeen: true,
          markAsImportant: true,
          reject: false,
          withKeywords: [],
          forwardTo: null
        }
      }
    ])
  })

  it('does not offer to file into the Outbox, Drafts or Templates', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES,
      mailboxes: [
        ...makeDefaultMailboxes(),
        makeMailbox({ id: 'mailbox-outbox', name: 'Outbox', role: 'outbox' }),
        makeMailbox({ id: 'mailbox-templates', name: 'Templates' }),
        makeMailbox({ id: 'mailbox-work', name: 'Work' })
      ]
    })
    installFakeFilter(server, [NEWSLETTERS])
    renderWithProviders(
      <MailboxPickerProvider>
        <EmailRulesSettings section={rulesSection()} />
      </MailboxPickerProvider>,
      {
        jmapServer: server,
        withJmapSession: true,
        route: { pathname: '/settings/email-rules' }
      }
    )

    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Newsletters' })
    )
    await userEvent.click(screen.getByTestId('rule-action-folder-button'))

    const picker = await screen.findByRole('dialog', {
      name: 'Choose a folder'
    })
    expect(within(picker).getByRole('option', { name: /Inbox/ })).toBeVisible()
    expect(within(picker).getByRole('option', { name: /Work/ })).toBeVisible()
    expect(within(picker).queryByRole('option', { name: /Outbox/ })).toBe(null)
    expect(within(picker).queryByRole('option', { name: /Drafts/ })).toBe(null)
    expect(within(picker).queryByRole('option', { name: /Templates/ })).toBe(
      null
    )
  })

  it('files into a folder created from the folder picker', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeFilter(server, [NEWSLETTERS])
    renderWithProviders(
      <MailboxPickerProvider>
        <EmailRulesSettings section={rulesSection()} />
      </MailboxPickerProvider>,
      {
        jmapServer: server,
        withJmapSession: true,
        route: { pathname: '/settings/email-rules' }
      }
    )

    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Newsletters' })
    )
    await userEvent.click(screen.getByTestId('rule-action-folder-button'))
    const picker = await screen.findByRole('dialog', {
      name: 'Choose a folder'
    })
    await userEvent.click(
      within(picker).getByRole('button', { name: 'New folder' })
    )
    await userEvent.type(
      within(
        screen.getByRole('dialog', { name: 'Create a New Folder' })
      ).getByRole('textbox', { name: 'Folder Name' }),
      'Receipts{Enter}'
    )

    expect(
      await screen.findByRole('button', { name: /Receipts/ })
    ).toHaveAttribute('data-testid', 'rule-action-folder-button')
  })

  it('creates a rule forwarding to valid addresses', async () => {
    const { filter } = setup([], { newRuleFrom: 'boss@example.com' })

    const dialog = await screen.findByRole('dialog', {
      name: 'Create a New Rule'
    })
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Rule Name' }),
      'Boss'
    )
    await userEvent.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Action 1' }),
      'Forward to'
    )
    const recipients = within(dialog).getByRole('textbox', {
      name: 'Recipients'
    })
    await userEvent.type(recipients, 'alice@example.com, bob')
    await userEvent.click(within(dialog).getByTestId('create-rule-button'))

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Incorrect email format'
    )
    expect(recipients).toHaveAttribute('aria-invalid', 'true')

    await userEvent.type(recipients, '@example.com')
    await userEvent.click(
      within(dialog).getByRole('checkbox', { name: 'Keep a copy' })
    )
    await userEvent.click(within(dialog).getByTestId('create-rule-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'New filter was created'
    )
    expect(filter.rules()).toEqual([
      {
        name: 'Boss',
        conditionGroup: {
          conditionCombiner: 'AND',
          conditions: [
            { field: 'from', comparator: 'contains', value: 'boss@example.com' }
          ]
        },
        action: {
          appendIn: { mailboxIds: [] },
          markAsSeen: false,
          markAsImportant: false,
          reject: false,
          forwardTo: {
            addresses: ['alice@example.com', 'bob@example.com'],
            keepACopy: false
          }
        }
      }
    ])
  })

  it('deletes a rule once confirmed', async () => {
    const { filter } = setup([NEWSLETTERS])

    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Newsletters' })
    )
    const confirm = screen.getByRole('dialog', { name: 'Delete rule' })
    expect(confirm).toHaveTextContent(
      'Do you want to delete rule "Newsletters"?'
    )
    await userEvent.click(
      within(confirm).getByTestId('confirm-dialog-confirm-button')
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'The rule has been removed.'
    )
    expect(filter.rules()).toEqual([])
    expect(await screen.findByTestId('email-rules-empty')).toBeVisible()
  })
})
