import { useMemo, useState, type ReactElement } from 'react'

import {
  ContactPickerDialog,
  type ContactPickerItem
} from '@/ds/ContactPickerDialog/ContactPickerDialog'
import { isValidEmail } from '@common/features/composer/recipients'
import { useContactSuggestions } from '@common/features/composer/useContactSuggestions'
import { useI18n } from '@common/i18n/useI18n'

import type { SearchFilter } from './searchFilter'

export interface SearchAddressDialogProps {
  field: 'from' | 'to'
  filter: SearchFilter
  /** Runs the search with the changed filter */
  onChange: (filter: SearchFilter) => void
  onClose: () => void
}

function contactName(contact: {
  firstname: string
  surname: string
}): string | null {
  const name = `${contact.firstname} ${contact.surname}`.trim()
  return name === '' ? null : name
}

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * The senders or recipients of a search, as tmail-flutter's contact view:
 * the chosen ones first, the contacts matching what is typed (and the
 * address typed, when it is one) to tick; "Done" runs the search with
 * them, "Clear filter" without any.
 */
export function SearchAddressDialog({
  field,
  filter,
  onChange,
  onClose
}: SearchAddressDialogProps): ReactElement {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<readonly string[]>(filter[field])
  // The names of the contacts ticked, to show them once the search is empty
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map())
  const contacts = useContactSuggestions(query)
  const typed = query.trim()

  const items = useMemo((): ContactPickerItem[] => {
    if (typed === '') {
      return selected.map(address => ({
        address,
        name: names.get(address.toLowerCase()) ?? null
      }))
    }
    const found = contacts.map(contact => ({
      address: contact.emailAddress,
      name: contactName(contact)
    }))
    return isValidEmail(typed) &&
      !found.some(item => sameAddress(item.address, typed))
      ? [...found, { address: typed, name: null }]
      : found
  }, [typed, contacts, selected, names])

  const handleToggle = (item: ContactPickerItem): void => {
    if (selected.some(address => sameAddress(address, item.address))) {
      setSelected(
        selected.filter(address => !sameAddress(address, item.address))
      )
      return
    }
    setSelected([...selected, item.address])
    if (item.name !== null) {
      setNames(new Map(names).set(item.address.toLowerCase(), item.name))
    }
  }

  return (
    <ContactPickerDialog
      open
      labels={{
        title: t(`search.contactPicker.${field}`),
        close: t('common.close'),
        search: t('search.contactPicker.hint'),
        clearSearch: t('search.clear'),
        list: t('search.contacts'),
        clearFilter: t('search.contactPicker.clearFilter'),
        done: t('search.contactPicker.done')
      }}
      query={query}
      onQueryChange={setQuery}
      items={items}
      selected={selected}
      onToggle={handleToggle}
      onClearFilter={() => {
        onClose()
        onChange({ ...filter, [field]: [] })
      }}
      onDone={() => {
        onClose()
        onChange({ ...filter, [field]: selected })
      }}
      onClose={onClose}
      testIds={{
        dialog: 'search-contact-picker',
        close: 'search-contact-picker-close-button',
        input: 'search-contact-picker-input',
        item: 'search-contact-picker-item',
        clearFilter: 'search-contact-picker-clear-filter-button',
        done: 'search-contact-picker-done-button'
      }}
    />
  )
}
