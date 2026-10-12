import { useMemo, useRef, useState, type ReactElement } from 'react'

import {
  RecipientField,
  type RecipientFieldChip,
  type RecipientFieldDnd
} from '@/ds/RecipientField/RecipientField'
import { useContactSuggestions } from '@common/features/composer/useContactSuggestions'
import { useI18n } from '@common/i18n/useI18n'

/** What a typed or pasted text adds: its entries, split on separators */
function splitEntries(text: string): string[] {
  return text
    .split(/[,;\n\r\t]/)
    .map(entry => entry.trim())
    .filter(entry => entry !== '')
}

function isList(text: string): boolean {
  return /[,;\n\r\t]/.test(text)
}

function sameEntry(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase()
}

/** `added` after `current`, without the entries already there */
export function mergeEntries(
  current: readonly string[],
  added: readonly string[]
): string[] {
  const merged = [...current]
  for (const entry of added) {
    if (!merged.some(other => sameEntry(other, entry))) merged.push(entry)
  }
  return merged
}

function toChip(entry: string): RecipientFieldChip {
  return {
    id: entry,
    label: entry,
    isInvalid: false,
    avatar: entry,
    avatarKey: entry
  }
}

export interface AddressFilterFieldProps {
  /** Its name; the visible label is the form row's, tied by `inputId` */
  label: string
  inputId: string
  placeholder: string
  /** Addresses or names searched for */
  values: readonly string[]
  onChange: (values: string[]) => void
  dnd: RecipientFieldDnd
  autoFocus?: boolean
  /** `from` or `to`: the `data-testid` of its parts */
  field: string
}

/**
 * From or To of the advanced search, as tmail-flutter's: a field of tags
 * with the contacts suggested as the user types, whose tags can be dragged
 * to the other field (or moved with Alt + arrows).
 */
export function AddressFilterField({
  label,
  inputId,
  placeholder,
  values,
  onChange,
  dnd,
  autoFocus = false,
  field
}: AddressFilterFieldProps): ReactElement {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const contacts = useContactSuggestions(input)
  const suggestions = useMemo(
    () =>
      contacts.map(contact => {
        const name = `${contact.firstname} ${contact.surname}`.trim()
        return {
          id: contact.emailAddress,
          label: name === '' ? contact.emailAddress : name,
          ...(name === '' ? {} : { secondary: contact.emailAddress }),
          isAdded: values.some(value => sameEntry(value, contact.emailAddress))
        }
      }),
    [contacts, values]
  )

  /** The tag taken back into the input, and where it stood */
  const edited = useRef<{ entry: string; index: number } | null>(null)

  const add = (entries: readonly string[]): void => {
    edited.current = null
    onChange(mergeEntries(values, entries))
    setInput('')
  }

  return (
    <RecipientField
      look="outlined"
      inputId={inputId}
      placeholder={placeholder}
      labels={{
        field: label,
        suggestions: t('composer.recipients.suggestions'),
        alreadyAdded: t('composer.recipients.alreadyAdded'),
        invalid: t('composer.recipients.invalid'),
        chipHelp: `${t('search.addresses.chipHelp')} ${t('composer.recipients.moveHelp')}`,
        removed: address => t('composer.recipients.removed', { address }),
        added: entries =>
          entries.length === 1
            ? t('search.addresses.added', { address: entries[0] ?? '' })
            : t('search.addresses.addedMany', { smart_count: entries.length })
      }}
      chips={values.map(toChip)}
      inputValue={input}
      onInputChange={setInput}
      onCommit={text => {
        add(splitEntries(text))
      }}
      onRemove={id => {
        onChange(values.filter(value => value !== id))
      }}
      onEdit={id => {
        edited.current = { entry: id, index: values.indexOf(id) }
        onChange(values.filter(value => value !== id))
        setInput(id)
      }}
      onCancelEdit={() => {
        const previous = edited.current
        edited.current = null
        setInput('')
        if (previous === null || values.includes(previous.entry)) return
        onChange([
          ...values.slice(0, previous.index),
          previous.entry,
          ...values.slice(previous.index)
        ])
      }}
      suggestions={suggestions}
      onSelectSuggestion={id => {
        add([id])
      }}
      isList={isList}
      status={t('composer.recipients.suggestionCount', {
        smart_count: suggestions.length
      })}
      autoFocus={autoFocus}
      dnd={dnd}
      testIds={{
        field: `advanced-search-${field}-field`,
        input: `advanced-search-${field}-input`,
        chip: 'advanced-search-address-chip',
        listbox: `advanced-search-${field}-suggestions`
      }}
    />
  )
}
