import { useEffect, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import {
  SearchCombobox,
  type SearchComboboxOption
} from '@/ds/SearchCombobox/SearchCombobox'
import { Spotlight } from '@/ds/Spotlight/Spotlight'
import { modifierKeyName } from '@common/features/shortcuts/shortcuts'
import { useI18n } from '@common/i18n/useI18n'

import { EMPTY_SEARCH_FILTER } from './searchFilter'
import { readSortOrder } from './searchStorage'
import { destinationPath, useDestinationOptions } from './useDestinationOptions'
import { useSearchOptions } from './useSearchOptions'

/**
 * A modal dialog, or a menu or a list box holding the focus: it would stay
 * open over the page SpotMail goes to.
 */
function isOtherPopupOpen(): boolean {
  return (
    document.querySelector('[aria-modal="true"]') !== null ||
    (document.activeElement?.closest('[role="menu"], [role="listbox"]') ??
      null) !== null
  )
}

/**
 * SpotMail: Ctrl+K (⌘K on a Mac) anywhere, again to close it. The search of
 * the top bar in a dialog of its own, which also goes to the folders, the
 * team mailboxes and the labels whose name holds the text.
 */
export function SpotMail(): ReactElement | null {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const isApple = modifierKeyName(navigator.userAgent) === '⌘'
    const toggle = (event: KeyboardEvent): void => {
      // The editor of a message takes Mod+K for a link, and handles it first
      if (event.defaultPrevented || event.isComposing) return
      // ⌘K on a Mac, where Ctrl+K deletes to the end of the line; Ctrl+Alt
      // is AltGr, which types a character
      const hasModifier = isApple
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey
      if (!hasModifier || event.altKey || event.key.toLowerCase() !== 'k')
        return
      event.preventDefault()
      setIsOpen(open => !open && !isOtherPopupOpen())
    }
    document.addEventListener('keydown', toggle)
    return () => {
      document.removeEventListener('keydown', toggle)
    }
  }, [])

  if (!isOpen) return null
  return (
    <SpotMailDialog
      onClose={() => {
        setIsOpen(false)
      }}
    />
  )
}

function SpotMailDialog({ onClose }: { onClose: () => void }): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => ({
    ...EMPTY_SEARCH_FILTER,
    sort: readSortOrder()
  }))
  const destinations = useDestinationOptions(draft.text)
  const search = useSearchOptions(draft, true, destinations)

  const handleSelect = (option: SearchComboboxOption): void => {
    onClose()
    const path = destinationPath(option.id)
    if (path === null) {
      search.select(option)
    } else {
      void navigate(path)
    }
  }

  return (
    <Spotlight
      title={t('spotMail.title')}
      hints={[
        { keys: '↑↓', label: t('spotMail.move') },
        { keys: '↵', label: t('common.open') },
        { keys: 'Esc', label: t('common.close') }
      ]}
      onClose={onClose}
      data-testid="spotmail-dialog"
    >
      <SearchCombobox
        inline
        value={draft.text}
        onChange={text => {
          setDraft(current => ({ ...current, text }))
        }}
        onSubmit={() => {
          onClose()
          search.submit()
        }}
        onSelect={handleSelect}
        groups={search.groups}
        label={t('search.placeholder')}
        listLabel={t('search.suggestions')}
        clearLabel={t('search.clear')}
        status={search.status}
        testIds={{
          input: 'spotmail-input',
          clear: 'spotmail-clear-button',
          listbox: 'spotmail-suggestions'
        }}
      />
    </Spotlight>
  )
}
