import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { DefaultFolderIcon } from '@/ds/FolderIcons/FolderIcons'
import {
  FolderPicker,
  type FolderPickerOption,
  type FolderPickerSection
} from '@/ds/FolderPicker/FolderPicker'
import { useI18n } from '@common/i18n/useI18n'

import { getMailboxIcon } from './mailboxDisplay'
import {
  buildMailboxSections,
  isTeamRoot,
  listVisibleMailboxes,
  mailboxPath,
  splitPersonalTree,
  teamMailboxAddress,
  type MailboxNode
} from './mailboxTree'
import type { MailboxSummary } from './queries'
import { useMailboxes } from './useMailboxes'
import { useMailboxName } from './useMailboxName'

export interface PickMailboxOptions {
  /** Title of the dialog, "Move To" by default */
  title?: string
  /** Listed faded, not selectable, e.g. the subfolders of a folder to move */
  disabledIds?: readonly string[]
  /**
   * The folder concerned (the one the emails are in, the folder to move,
   * `PICKED_ROOT` for the top level): bold with a check, not selectable,
   * shown unfolded
   */
  currentId?: string
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

  const sections = useMemo((): FolderPickerSection[] => {
    if (pending === null) return []
    const disabled = new Set(pending.disabledIds ?? [])
    const { personal, team } = buildMailboxSections(mailboxes, false)
    const { system, folders } = splitPersonalTree(personal)
    const toOptions = (trees: readonly MailboxNode[]): FolderPickerOption[] =>
      listVisibleMailboxes(trees, () => true).map(
        ({ mailbox, level, hasChildren }): FolderPickerOption => {
          const isRoot = isTeamRoot(mailbox)
          return {
            id: mailbox.id,
            label: getName(mailbox),
            // Searched by its path; a team mailbox by its address too
            secondary: mailboxPath(mailboxes, mailbox.id, getName),
            // As tmail-flutter: a team mailbox shows its address, no icon
            subtitle: isRoot
              ? (teamMailboxAddress(mailbox) ?? mailbox.name)
              : null,
            level,
            parentId: mailbox.parentId,
            hasChildren,
            icon: isRoot ? null : getMailboxIcon(mailbox),
            isCurrent: mailbox.id === pending.currentId,
            disabled:
              disabled.has(mailbox.id) ||
              (pending.requireAddItems === true &&
                !mailbox.myRights.mayAddItems)
          }
        }
      )
    const rootLabel = pending.rootLabel
    const root: FolderPickerOption[] =
      rootLabel === undefined
        ? []
        : [
            {
              id: ROOT_OPTION_ID,
              label: rootLabel,
              secondary: rootLabel,
              level: 1,
              parentId: null,
              hasChildren: false,
              icon: DefaultFolderIcon,
              isCurrent: pending.currentId === PICKED_ROOT
            }
          ]
    return [
      { id: 'system', label: null, options: [...root, ...toOptions(system)] },
      {
        id: 'personal',
        label: t('mailboxPicker.personalFolders'),
        options: toOptions(folders)
      },
      ...(pending.personalOnly === true
        ? []
        : [
            {
              id: 'team',
              label: t('sidebar.teamMailboxes'),
              options: toOptions(team)
            }
          ])
    ]
  }, [mailboxes, getName, pending, t])

  // The way to the folder concerned (or the first one left out, the folder
  // to move), unfolded
  const expandedIds = useMemo((): string[] => {
    const currentId = pending?.currentId ?? pending?.disabledIds?.[0]
    if (currentId === undefined || currentId === PICKED_ROOT) return []
    const ids: string[] = []
    let parentId =
      mailboxes.find(mailbox => mailbox.id === currentId)?.parentId ?? null
    while (parentId !== null) {
      ids.push(parentId)
      const parent = parentId
      parentId =
        mailboxes.find(mailbox => mailbox.id === parent)?.parentId ?? null
    }
    return ids
  }, [mailboxes, pending])

  const handleSelect = (option: FolderPickerOption): void => {
    if (option.id === ROOT_OPTION_ID) {
      close(PICKED_ROOT)
      return
    }
    close(mailboxes.find(mailbox => mailbox.id === option.id) ?? null)
  }
  const handleClose = (): void => {
    close(null)
  }

  return (
    <PickMailboxContext.Provider value={pick}>
      {children}
      <FolderPicker
        open={pending !== null}
        labels={{
          title: pending?.title ?? t('mailboxPicker.title'),
          close: t('common.close'),
          search: t('mailboxPicker.search'),
          empty: t('mailboxPicker.empty'),
          collapsed: t('mailboxPicker.collapsed'),
          expanded: t('mailboxPicker.expanded'),
          current: t('mailboxPicker.current')
        }}
        sections={sections}
        initiallyExpandedIds={expandedIds}
        onSelect={handleSelect}
        onClose={handleClose}
        testIds={{
          dialog: 'mailbox-picker',
          close: 'mailbox-picker-close-button',
          input: 'mailbox-picker-search-input',
          listbox: 'mailbox-picker-list',
          option: 'mailbox-picker-item'
        }}
      />
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
