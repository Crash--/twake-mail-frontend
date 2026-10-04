import { Cross, Icon } from '@linagora/twake-icons'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip
} from '@linagora/twake-mui'
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  FilterableListbox,
  type FilterableListboxOption
} from '@/ds/FilterableListbox/FilterableListbox'
import { useI18n } from '@common/i18n/useI18n'

import { getMailboxIcon } from './mailboxDisplay'
import {
  buildMailboxTree,
  listVisibleMailboxes,
  mailboxPath
} from './mailboxTree'
import type { MailboxSummary } from './queries'
import { useMailboxes } from './useMailboxes'
import { useMailboxName } from './useMailboxName'

export interface PickMailboxOptions {
  /** Title of the dialog, "Move To" by default */
  title?: string
  /** Listed but not selectable, e.g. the folder the emails are in */
  disabledIds?: readonly string[]
}

/** Asks for a folder; resolves to it, or null when the user closes */
export type PickMailbox = (
  options?: PickMailboxOptions
) => Promise<MailboxSummary | null>

const PickMailboxContext = createContext<PickMailbox | null>(null)

interface PendingPick extends PickMailboxOptions {
  resolve: (mailbox: MailboxSummary | null) => void
}

export interface MailboxPickerProviderProps {
  children: ReactNode
}

/**
 * The folder picker, as tmail-flutter's destination picker: a dialog with
 * the tree of the folders and a field filtering them by name or path
 * (`ds/FilterableListbox`). `await pickMailbox()` resolves to the folder
 * chosen; the focus goes back to what opened it.
 */
export function MailboxPickerProvider({
  children
}: MailboxPickerProviderProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const getName = useMailboxName()
  const { data: mailboxes = [] } = useMailboxes()
  const [pending, setPending] = useState<PendingPick | null>(null)
  const pendingRef = useRef<PendingPick | null>(null)

  const pick = useCallback<PickMailbox>(
    (options = {}) =>
      new Promise(resolve => {
        pendingRef.current?.resolve(null)
        const next = { ...options, resolve }
        pendingRef.current = next
        setPending(next)
      }),
    []
  )

  const close = (mailbox: MailboxSummary | null): void => {
    pendingRef.current?.resolve(mailbox)
    pendingRef.current = null
    setPending(null)
  }

  const options = useMemo((): FilterableListboxOption[] => {
    const disabled = new Set(pending?.disabledIds ?? [])
    return listVisibleMailboxes(buildMailboxTree(mailboxes), () => true).map(
      ({ mailbox, level }) => ({
        id: mailbox.id,
        label: getName(mailbox),
        secondary: mailboxPath(mailboxes, mailbox.id, getName),
        level,
        icon: getMailboxIcon(mailbox),
        disabled: disabled.has(mailbox.id)
      })
    )
  }, [mailboxes, getName, pending])

  const handleSelect = (option: FilterableListboxOption): void => {
    close(mailboxes.find(mailbox => mailbox.id === option.id) ?? null)
  }
  const handleClose = (): void => {
    close(null)
  }
  const closeLabel = t('common.close')

  return (
    <PickMailboxContext.Provider value={pick}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={handleClose}
        size="small"
        aria-labelledby={titleId}
        data-testid="mailbox-picker"
      >
        <DialogTitle id={titleId} className="u-flex u-flex-items-center">
          <span className="u-flex-auto">
            {pending?.title ?? t('mailboxPicker.title')}
          </span>
          <Tooltip title={closeLabel}>
            <IconButton
              aria-label={closeLabel}
              onClick={handleClose}
              data-testid="mailbox-picker-close-button"
            >
              <Icon icon={Cross} />
            </IconButton>
          </Tooltip>
        </DialogTitle>
        <DialogContent>
          {pending === null ? null : (
            <FilterableListbox
              options={options}
              onSelect={handleSelect}
              filterLabel={t('mailboxPicker.search')}
              listLabel={t('sidebar.folders')}
              emptyLabel={t('mailboxPicker.empty')}
              testIds={{
                input: 'mailbox-picker-search-input',
                listbox: 'mailbox-picker-list',
                option: 'mailbox-picker-item'
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PickMailboxContext.Provider>
  )
}

/** The folder picker; without its provider (tests), it picks nothing */
export function usePickMailbox(): PickMailbox {
  return useContext(PickMailboxContext) ?? noPick
}

function noPick(): Promise<null> {
  return Promise.resolve(null)
}
