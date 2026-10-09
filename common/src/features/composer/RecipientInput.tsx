import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'
import {
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'
import { useNavigate } from 'react-router'

import {
  RecipientField,
  type RecipientFieldActions,
  type RecipientFieldCard,
  type RecipientFieldDnd
} from '@/ds/RecipientField/RecipientField'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import type { NewRuleLocationState } from '@common/features/rules/EmailRulesSettings'
import { settingsSectionPath } from '@common/features/settings/sections'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  formatRecipient,
  hasRecipient,
  mergeRecipients,
  parseRecipients,
  type Recipient
} from './recipients'
import { recipientChips } from './recipientChips'
import { useContactSuggestions } from './useContactSuggestions'

/** A list of addresses: separators, or several `@` */
function isList(text: string): boolean {
  return /[,;\n\r\t]/.test(text) || (text.match(/@/g) ?? []).length > 1
}

function contactName(contact: {
  firstname: string
  surname: string
}): string | null {
  const name = `${contact.firstname} ${contact.surname}`.trim()
  return name === '' ? null : name
}

export interface RecipientInputProps {
  /** `to`, `cc`, `bcc`, `reply-to`: the `data-testid` of its parts */
  field: string
  label: string
  recipients: readonly Recipient[]
  onChange: (recipients: Recipient[]) => void
  inputValue: string
  onInputChange: (value: string) => void
  endActions?: ReactNode
  onFocus?: () => void
  autoFocus?: boolean
  actions?: Ref<RecipientFieldActions>
  /** Recipients dragged to another field, emails dropped here */
  dnd?: RecipientFieldDnd
}

/**
 * One recipient field of the composer: what is typed or pasted becomes
 * recipients (`Name <address>` or addresses, invalid ones kept and shown
 * as such), contacts are suggested as the user types.
 */
export function RecipientInput({
  field,
  label,
  recipients,
  onChange,
  inputValue,
  onInputChange,
  endActions,
  onFocus,
  autoFocus,
  actions,
  dnd
}: RecipientInputProps): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { notify } = useNotify()
  const { session } = useJmapSession()
  const hasRules = LINAGORA_CAPABILITIES.filter in session.capabilities
  const contacts = useContactSuggestions(inputValue)
  // As tmail-flutter: the contacts already entered stay, ticked
  const suggestions = useMemo(
    () =>
      contacts.map(contact => {
        const name = contactName(contact)
        return {
          id: contact.emailAddress,
          label: name ?? contact.emailAddress,
          ...(name === null ? {} : { secondary: contact.emailAddress }),
          isAdded: hasRecipient(recipients, contact.emailAddress)
        }
      }),
    [contacts, recipients]
  )

  const chips = recipientChips(recipients)
  /** The recipient taken back into the input, and where it stood */
  const edited = useRef<{ recipient: Recipient; index: number } | null>(null)

  const handleCommit = (text: string): void => {
    edited.current = null
    onChange(mergeRecipients(recipients, parseRecipients(text)))
    onInputChange('')
  }

  const handleRemove = (id: string): void => {
    onChange(recipients.filter(recipient => recipient.email !== id))
  }

  const handleEdit = (id: string): void => {
    const index = recipients.findIndex(recipient => recipient.email === id)
    const recipient = recipients[index]
    if (!recipient) return
    edited.current = { recipient, index }
    onChange(recipients.filter(other => other !== recipient))
    onInputChange(formatRecipient(recipient))
  }

  const handleCancelEdit = (): void => {
    const previous = edited.current
    edited.current = null
    onInputChange('')
    if (
      previous === null ||
      hasRecipient(recipients, previous.recipient.email)
    ) {
      return
    }
    onChange([
      ...recipients.slice(0, previous.index),
      previous.recipient,
      ...recipients.slice(previous.index)
    ])
  }

  // tmail-flutter's card of a recipient: copy the address, edit it, or
  // create a filtering rule from it
  const card: RecipientFieldCard = {
    labels: {
      copy: t('email.address.copy'),
      edit: t('composer.recipients.editEmail'),
      createRule: t('composer.recipients.createRule'),
      close: t('email.address.close')
    },
    onCopy: id => {
      window.navigator.clipboard
        .writeText(id)
        .then(() => {
          notify({ message: t('email.address.copied'), severity: 'success' })
        })
        .catch((error: unknown) => {
          console.warn('[composer] Cannot copy the address', error)
        })
    },
    onCreateRule: hasRules
      ? id => {
          void navigate(settingsSectionPath('email-rules'), {
            state: { newRuleFrom: id } satisfies NewRuleLocationState
          })
        }
      : null,
    testIds: {
      card: 'recipient-card',
      copy: 'recipient-card-copy-button',
      edit: 'recipient-card-edit-button',
      createRule: 'recipient-card-create-rule-button',
      close: 'recipient-card-close-button'
    }
  }

  const handleSelect = (id: string): void => {
    edited.current = null
    const contact = contacts.find(candidate => candidate.emailAddress === id)
    onChange(
      mergeRecipients(recipients, [
        { name: contact ? contactName(contact) : null, email: id }
      ])
    )
    onInputChange('')
  }

  return (
    <RecipientField
      labels={{
        field: label,
        suggestions: t('composer.recipients.suggestions'),
        alreadyAdded: t('composer.recipients.alreadyAdded'),
        invalid: t('composer.recipients.invalid'),
        chipHelp:
          dnd?.onMoveBy === undefined
            ? t('composer.recipients.chipHelp')
            : `${t('composer.recipients.chipHelp')} ${t('composer.recipients.moveHelp')}`,
        removed: address => t('composer.recipients.removed', { address }),
        added: addresses =>
          addresses.length === 1
            ? t('composer.recipients.added', { address: addresses[0] ?? '' })
            : t('composer.recipients.addedMany', {
                smart_count: addresses.length
              })
      }}
      chips={chips}
      inputValue={inputValue}
      onInputChange={onInputChange}
      onCommit={handleCommit}
      onRemove={handleRemove}
      onEdit={handleEdit}
      card={card}
      onCancelEdit={handleCancelEdit}
      suggestions={suggestions}
      onSelectSuggestion={handleSelect}
      isList={isList}
      status={t('composer.recipients.suggestionCount', {
        smart_count: suggestions.length
      })}
      endActions={endActions}
      onFocus={onFocus}
      autoFocus={autoFocus}
      actions={actions}
      dnd={dnd}
      testIds={{
        field: `composer-${field}-field`,
        input: `composer-${field}-input`,
        chip: 'recipient-chip',
        listbox: `composer-${field}-suggestions`
      }}
    />
  )
}
