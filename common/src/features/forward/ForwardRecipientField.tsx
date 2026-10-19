import { useMemo, useRef, type ReactElement, type Ref } from 'react'

import {
  RecipientField,
  type RecipientFieldActions,
  type RecipientFieldChip
} from '@/ds/RecipientField/RecipientField'
import {
  isValidEmail,
  parseRecipients,
  withTypedAddressFirst
} from '@common/features/composer/recipients'
import { useContactSuggestions } from '@common/features/composer/useContactSuggestions'
import { useI18n } from '@common/i18n/useI18n'

function sameEmail(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase()
}

/** Whether pasted text holds several addresses */
function isList(text: string): boolean {
  return /[,;\n\r\t]/.test(text)
}

/** `added` after `current`, each address once whatever its case */
export function mergeEmails(
  current: readonly string[],
  added: readonly string[]
): string[] {
  const merged = [...current]
  for (const email of added) {
    if (!merged.some(other => sameEmail(other, email))) merged.push(email)
  }
  return merged
}

/** The addresses of a typed or pasted text, invalid ones included */
export function emailsOf(text: string): string[] {
  return parseRecipients(text).map(recipient => recipient.email)
}

function toChip(email: string): RecipientFieldChip {
  const isInvalid = !isValidEmail(email)
  return {
    id: email,
    label: email,
    isInvalid,
    ...(isInvalid ? {} : { avatar: email, avatarKey: email })
  }
}

export interface ForwardRecipientFieldProps {
  inputId: string
  /** The addresses about to be added, as tags */
  values: readonly string[]
  onChange: (values: string[]) => void
  inputValue: string
  onInputChange: (value: string) => void
  /** Already forwarded to: their suggestions are ticked */
  forwards: readonly string[]
  hasError: boolean
  describedBy?: string
  actions?: Ref<RecipientFieldActions>
}

/**
 * The addresses to forward to, as tmail-flutter's
 * `AutocompleteContactTextFieldWithTags`: tags, the contacts suggested as
 * the user types (`TMailContact/autocomplete`), a pasted list split into
 * tags, invalid addresses in red and said so; the ones already forwarded
 * to, or already tags, ticked in the suggestions.
 */
export function ForwardRecipientField({
  inputId,
  values,
  onChange,
  inputValue,
  onInputChange,
  forwards,
  hasError,
  describedBy,
  actions
}: ForwardRecipientFieldProps): ReactElement {
  const { t } = useI18n()
  const { contacts, loadMore } = useContactSuggestions(inputValue)
  const suggestions = useMemo(() => {
    const isAdded = (email: string): boolean =>
      values.some(value => sameEmail(value, email)) ||
      forwards.some(forward => sameEmail(forward, email))
    return withTypedAddressFirst(
      contacts.map(contact => {
        const name = `${contact.firstname} ${contact.surname}`.trim()
        return {
          id: contact.emailAddress,
          label: name === '' ? contact.emailAddress : name,
          ...(name === '' ? {} : { secondary: contact.emailAddress }),
          isAdded: isAdded(contact.emailAddress)
        }
      }),
      inputValue,
      email => ({ id: email, label: email, isAdded: isAdded(email) })
    )
  }, [contacts, values, forwards, inputValue])

  /** The tag taken back into the input, and where it stood */
  const edited = useRef<{ email: string; index: number } | null>(null)

  const add = (emails: readonly string[]): void => {
    edited.current = null
    onChange(mergeEmails(values, emails))
    onInputChange('')
  }

  return (
    <RecipientField
      look="outlined"
      inputId={inputId}
      placeholder={t('forward.inputPlaceholder')}
      labels={{
        field: t('forward.inputLabel'),
        suggestions: t('composer.recipients.suggestions'),
        alreadyAdded: t('composer.recipients.alreadyAdded'),
        invalid: t('composer.recipients.invalid'),
        chipHelp: t('search.addresses.chipHelp'),
        removed: address => t('composer.recipients.removed', { address }),
        added: emails =>
          emails.length === 1
            ? t('search.addresses.added', { address: emails[0] ?? '' })
            : t('search.addresses.addedMany', { smart_count: emails.length })
      }}
      chips={values.map(toChip)}
      inputValue={inputValue}
      onInputChange={onInputChange}
      onCommit={text => {
        add(emailsOf(text))
      }}
      onRemove={id => {
        onChange(values.filter(value => value !== id))
      }}
      onEdit={id => {
        edited.current = { email: id, index: values.indexOf(id) }
        onChange(values.filter(value => value !== id))
        onInputChange(id)
      }}
      onCancelEdit={() => {
        const previous = edited.current
        edited.current = null
        onInputChange('')
        if (previous === null || values.includes(previous.email)) return
        onChange([
          ...values.slice(0, previous.index),
          previous.email,
          ...values.slice(previous.index)
        ])
      }}
      suggestions={suggestions}
      onLoadMore={loadMore}
      onSelectSuggestion={id => {
        add([id])
      }}
      isList={isList}
      status={t('composer.recipients.suggestionCount', {
        smart_count: suggestions.length
      })}
      hasError={hasError}
      describedBy={describedBy}
      actions={actions}
      testIds={{
        field: 'forward-recipient-field',
        input: 'forward-input',
        chip: 'forward-recipient-chip',
        listbox: 'forward-suggestions'
      }}
    />
  )
}
