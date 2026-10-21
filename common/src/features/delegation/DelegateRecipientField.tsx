import { useMemo, useRef, type ReactElement, type Ref } from 'react'

import {
  RecipientField,
  type RecipientFieldActions,
  type RecipientFieldChip
} from '@/ds/RecipientField/RecipientField'
import {
  isValidEmail,
  withTypedAddressFirst
} from '@common/features/composer/recipients'
import { useContactSuggestions } from '@common/features/composer/useContactSuggestions'
import {
  emailsOf,
  mergeEmails
} from '@common/features/forward/ForwardRecipientField'
import { domainOf } from '@common/features/forward/queries'
import { useI18n } from '@common/i18n/useI18n'

function sameEmail(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase()
}

/** Whether pasted text holds several addresses */
function isList(text: string): boolean {
  return /[,;\n\r\t]/.test(text)
}

export interface DelegateRecipientFieldProps {
  inputId: string
  /** The addresses picked, as chips */
  values: readonly string[]
  onChange: (values: string[]) => void
  inputValue: string
  onInputChange: (value: string) => void
  /** The domain of the user: only its people may be given access */
  domain: string
  /** Already delegates, or the user: never suggested */
  excluded: readonly string[]
  /** The chips a delegation cannot be given to (red, said invalid) */
  isRefused: (email: string) => boolean
  hasError: boolean
  describedBy?: string
  actions?: Ref<RecipientFieldActions>
}

/**
 * The people to give access to: chips, the contacts of the user's domain
 * suggested as they type (`TMailContact/autocomplete`, the others left
 * out: a delegation stays within the domain), a pasted list split into
 * chips, refused addresses in red and said so.
 */
export function DelegateRecipientField({
  inputId,
  values,
  onChange,
  inputValue,
  onInputChange,
  domain,
  excluded,
  isRefused,
  hasError,
  describedBy,
  actions
}: DelegateRecipientFieldProps): ReactElement {
  const { t } = useI18n()
  const { contacts, loadMore } = useContactSuggestions(inputValue)
  const suggestions = useMemo(() => {
    const isAdded = (email: string): boolean =>
      values.some(value => sameEmail(value, email))
    const isExcluded = (email: string): boolean =>
      excluded.some(other => sameEmail(other, email))
    const inDomain = (email: string): boolean => domainOf(email) === domain
    const all = withTypedAddressFirst(
      contacts
        .filter(contact => inDomain(contact.emailAddress))
        .map(contact => {
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
    return all.filter(
      suggestion => inDomain(suggestion.id) && !isExcluded(suggestion.id)
    )
  }, [contacts, values, excluded, inputValue, domain])

  const toChip = (email: string): RecipientFieldChip => {
    const isInvalid = !isValidEmail(email) || isRefused(email)
    return {
      id: email,
      label: email,
      isInvalid,
      ...(isInvalid ? {} : { avatar: email, avatarKey: email })
    }
  }

  /** The chip taken back into the input, and where it stood */
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
      placeholder={t('delegation.add.placeholder')}
      labels={{
        field: t('delegation.add.field'),
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
        field: 'delegation-recipient-field',
        input: 'delegation-input',
        chip: 'delegation-recipient-chip',
        listbox: 'delegation-suggestions'
      }}
    />
  )
}
