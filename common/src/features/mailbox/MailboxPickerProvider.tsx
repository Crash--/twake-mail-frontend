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
  buildMailboxSections,
  isTeamRoot,
  listVisibleMailboxes,
  mailboxPath,
  teamMailboxAddress
} from './mailboxTree'
import type { MailboxSummary } from './queries'
import { useMailboxes } from './useMailboxes'
import { useMailboxName } from './useMailboxName'

export interface PickMailboxOptions {
  /** Title of the dialog, "Move To" by default */
  title?: string
  /** Listed but not selectable, e.g. the folder the emails are in */
  disabledIds?: readonly string[]
  /**
   * A first option standing for the top level ("Personal folders"), for a
   * folder to create or move: chosen, it resolves to `PICKED_ROOT`
   */
  rootLabel?: string
  /** Folders emails cannot be added to (`mayAddItems`) are listed, not selectable */
  requireAddItems?: boolean
  /** The personal folders only, not the team mailboxes */
  personalOnly?: boolean
}

/** The top level, when `rootLabel` is given */
export const PICKED_ROOT = 'root'

/**
 * Asks for a folder; resolves to it (`PICKED_ROOT` for the top level), or
 * null when the user closes
 */
export type PickMailbox = (
  options?: PickMailboxOptions
) => Promise<MailboxSummary | typeof PICKED_ROOT | null>

const PickMailboxContext = createContext<PickMailbox | null>(null)

/** Not a mailbox id: JMAP ids never hold a space */
const ROOT_OPTION_ID = 'top level'

interface PendingPick extends PickMailboxOptions {
  resolve: (mailbox: MailboxSummary | typeof PICKED_ROOT | null) => void
}

export interface MailboxPickerProviderProps {
  children: ReactNode
}

/**
 * The folder picker, as tmail-flutter's destination picker: a dialog with
 * the tree of the folders and a field filtering them by name or path
 * (`ds/FilterableListbox`), the personal folders then the team mailboxes;
 * hidden folders are not offered. `await pickMailbox()` resolves to the
 * folder chosen; the focus goes back to what opened it.
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

  const close = (mailbox: MailboxSummary | typeof PICKED_ROOT | null): void => {
    pendingRef.current?.resolve(mailbox)
    pendingRef.current = null
    setPending(null)
  }

  const options = useMemo((): FilterableListboxOption[] => {
    const disabled = new Set(pending?.disabledIds ?? [])
    const { personal, team } = buildMailboxSections(mailboxes, false)
    const trees =
      pending?.personalOnly === true ? personal : [...personal, ...team]
    const folders = listVisibleMailboxes(trees, () => true).map(
      ({ mailbox, level }): FilterableListboxOption => ({
        id: mailbox.id,
        label: getName(mailbox),
        // The root of a team mailbox is found by its address too
        secondary: isTeamRoot(mailbox)
          ? (teamMailboxAddress(mailbox) ?? mailbox.name)
          : mailboxPath(mailboxes, mailbox.id, getName),
        level,
        icon: getMailboxIcon(mailbox),
        disabled:
          disabled.has(mailbox.id) ||
          (pending?.requireAddItems === true && !mailbox.myRights.mayAddItems)
      })
    )
    const rootLabel = pending?.rootLabel
    return rootLabel === undefined
      ? folders
      : [
          { id: ROOT_OPTION_ID, label: rootLabel, secondary: rootLabel },
          ...folders
        ]
  }, [mailboxes, getName, pending])

  const handleSelect = (option: FilterableListboxOption): void => {
    if (option.id === ROOT_OPTION_ID) {
      close(PICKED_ROOT)
      return
    }
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
