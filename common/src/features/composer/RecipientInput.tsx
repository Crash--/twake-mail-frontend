import { useMemo, type ReactElement, type ReactNode, type Ref } from 'react'

import {
  RecipientField,
  type RecipientFieldActions,
  type RecipientFieldChip
} from '@/ds/RecipientField/RecipientField'
import { useI18n } from '@common/i18n/useI18n'

import {
  formatRecipient,
  hasRecipient,
  isValidEmail,
  mergeRecipients,
  parseRecipients,
  type Recipient
} from './recipients'
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
  actions
}: RecipientInputProps): ReactElement {
  const { t } = useI18n()
  const contacts = useContactSuggestions(inputValue)
  const suggestions = useMemo(
    () =>
      contacts
        .filter(contact => !hasRecipient(recipients, contact.emailAddress))
        .map(contact => {
          const name = contactName(contact)
          return {
            id: contact.emailAddress,
            label: name ?? contact.emailAddress,
            ...(name === null ? {} : { secondary: contact.emailAddress })
          }
        }),
    [contacts, recipients]
  )

  const chips: RecipientFieldChip[] = recipients.map(recipient => ({
    id: recipient.email,
    label: recipient.name ?? recipient.email,
    title: formatRecipient(recipient),
    isInvalid: !isValidEmail(recipient.email)
  }))

  const handleCommit = (text: string): void => {
    onChange(mergeRecipients(recipients, parseRecipients(text)))
    onInputChange('')
  }

  const handleRemove = (id: string): void => {
    onChange(recipients.filter(recipient => recipient.email !== id))
  }

  const handleEdit = (id: string): void => {
    const edited = recipients.find(recipient => recipient.email === id)
    if (!edited) return
    onChange(recipients.filter(recipient => recipient !== edited))
    onInputChange(formatRecipient(edited))
  }

  const handleSelect = (id: string): void => {
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
        invalid: t('composer.recipients.invalid'),
        chipHelp: t('composer.recipients.chipHelp'),
        removed: address => t('composer.recipients.removed', { address })
      }}
      chips={chips}
      inputValue={inputValue}
      onInputChange={onInputChange}
      onCommit={handleCommit}
      onRemove={handleRemove}
      onEdit={handleEdit}
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
      testIds={{
        field: `composer-${field}-field`,
        input: `composer-${field}-input`,
        chip: 'recipient-chip',
        listbox: `composer-${field}-suggestions`
      }}
    />
  )
}
