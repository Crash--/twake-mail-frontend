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

import type { IconProps } from '@linagora/twake-icons'

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
  /** Said after the folder concerned, "current folder" by default */
  currentLabel?: string
}

/** A choice listed before the folders, e.g. "All email" for a search */
export interface PickChoice {
  /** Not a mailbox id: holds a space */
  id: string
  label: string
  icon: IconProps['icon']
  /**
   * `top`: first of the system folders (default); `section`: in a block
   * of its own after them, as tmail-flutter's "All Email, trash & spam"
   */
  placement?: 'top' | 'section'
}

export interface PickFolderOrChoiceOptions extends PickMailboxOptions {
  choices: readonly PickChoice[]
}

/** What the picker resolves to */
type Picked = MailboxSummary | typeof PICKED_ROOT | PickChoice | null

/** The top level, when `rootLabel` is given */
export const PICKED_ROOT = 'root'

/**
 * Asks for a folder; resolves to it (`PICKED_ROOT` for the top level), or
 * null when the user closes
 */
export type PickMailbox = (
  options?: PickMailboxOptions
) => Promise<MailboxSummary | typeof PICKED_ROOT | null>

/**
 * Asks for a folder or one of the choices listed before them; resolves to
 * it, or null when the user closes
 */
export type PickFolderOrChoice = (
  options: PickFolderOrChoiceOptions
) => Promise<MailboxSummary | PickChoice | null>

interface PickContext {
  pick: PickMailbox
  pickFolderOrChoice: PickFolderOrChoice
}

const PickMailboxContext = createContext<PickContext | null>(null)

/** Not a mailbox id: JMAP ids never hold a space */
const ROOT_OPTION_ID = 'top level'

interface PendingPick extends PickMailboxOptions {
  choices?: readonly PickChoice[]
  resolve: (picked: Picked) => void
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

  const open = useCallback(
    (options: PickMailboxOptions & { choices?: readonly PickChoice[] }) =>
      new Promise<Picked>(resolve => {
        pendingRef.current?.resolve(null)
        const next = { ...options, resolve }
        pendingRef.current = next
        setPending(next)
      }),
    []
  )
  const context = useMemo(
    (): PickContext => ({
      pick: async (options = {}) => {
        const picked = await open(options)
        return typeof picked === 'object' && picked !== null && 'icon' in picked
          ? null
          : picked
      },
      pickFolderOrChoice: async options => {
        const picked = await open(options)
        return picked === PICKED_ROOT ? null : picked
      }
    }),
    [open]
  )

  const close = (picked: Picked): void => {
    pendingRef.current?.resolve(picked)
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
    const toChoiceOption = (choice: PickChoice): FolderPickerOption => ({
      id: choice.id,
      label: choice.label,
      secondary: choice.label,
      level: 1,
      parentId: null,
      hasChildren: false,
      icon: choice.icon,
      isCurrent: pending.currentId === choice.id
    })
    const choices = pending.choices ?? []
    const top = choices
      .filter(choice => choice.placement !== 'section')
      .map(toChoiceOption)
    const own = choices
      .filter(choice => choice.placement === 'section')
      .map(toChoiceOption)
    return [
      {
        id: 'system',
        label: null,
        options: [...top, ...root, ...toOptions(system)]
      },
      { id: 'choices', label: null, options: own },
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
    const choice = pending?.choices?.find(item => item.id === option.id)
    if (choice !== undefined) {
      close(choice)
      return
    }
    close(mailboxes.find(mailbox => mailbox.id === option.id) ?? null)
  }
  const handleClose = (): void => {
    close(null)
  }

  return (
    <PickMailboxContext.Provider value={context}>
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
          current: pending?.currentLabel ?? t('mailboxPicker.current')
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
  return useContext(PickMailboxContext)?.pick ?? noPick
}

/** The folder picker with choices before the folders, e.g. a search scope */
export function usePickFolderOrChoice(): PickFolderOrChoice {
  return useContext(PickMailboxContext)?.pickFolderOrChoice ?? noPick
}

function noPick(): Promise<null> {
  return Promise.resolve(null)
}
