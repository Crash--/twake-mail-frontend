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
import { validateFolderName } from '@common/features/mailboxActions/folderName'
import { MailboxNameDialog } from '@common/features/mailboxActions/MailboxNameDialog'
import { useCreateFolder } from '@common/features/mailboxActions/useCreateFolder'
import { useI18n } from '@common/i18n/useI18n'

import { getMailboxIcon } from './mailboxDisplay'
import {
  buildMailboxSections,
  isSharedRoot,
  isTeamRoot,
  listVisibleMailboxes,
  mailboxPath,
  pruneMailboxRoles,
  splitPersonalTree,
  sharedMailboxOwner,
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
  /** The top level (`rootLabel`) listed faded, not selectable */
  isRootDisabled?: boolean
  /** Folders emails cannot be added to (`mayAddItems`) are listed, not selectable */
  requireAddItems?: boolean
  /** The personal folders only, not the team mailboxes */
  personalOnly?: boolean
  /**
   * The root of a team mailbox, a container, is selectable, e.g. a search
   * scope covering all its folders; never a destination otherwise
   */
  isTeamRootPickable?: boolean
  /**
   * The folders of these roles (and what they hold) are not offered, in the
   * team mailboxes too, e.g. Outbox, Drafts and Templates for a rule
   */
  excludedRoles?: readonly string[]
  /** Said after the folder concerned, "current folder" by default */
  currentLabel?: string
  /**
   * A "New folder" button, as tmail-flutter (tf#899): the folder created
   * is the one picked
   */
  canCreateFolder?: boolean
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

interface PickerView extends PickMailboxOptions {
  choices?: readonly PickChoice[]
}

interface PendingPick extends PickerView {
  resolve: (picked: Picked) => void
}

/**
 * A folder created from the picker: named (`name`), its location chosen
 * in the picker (`parent`), or sent to the server (`saving`)
 */
interface Creation {
  parentId: string | null
  stage: 'name' | 'parent' | 'saving'
}

export interface MailboxPickerProviderProps {
  children: ReactNode
}

/**
 * The folder picker, as tmail-flutter's destination picker: a dialog with
 * the tree of the folders and a field filtering them by name or path
 * (`ds/FilterableListbox`), the personal folders then the team mailboxes;
 * hidden folders are not offered, and the root of a team mailbox, a
 * container, is never a destination (`isTeamRootPickable` for a search
 * scope). `await pickMailbox()` resolves to the
 * folder chosen; the focus goes back to what opened it. With
 * `canCreateFolder`, its "New folder" button opens the dialog creating a
 * folder; the folder created is picked, and cancelling goes back to the
 * picker.
 */
export function MailboxPickerProvider({
  children
}: MailboxPickerProviderProps): ReactElement {
  const { t } = useI18n()
  const getName = useMailboxName()
  const { data: mailboxes = [] } = useMailboxes()
  const createFolder = useCreateFolder()
  const [pending, setPending] = useState<PendingPick | null>(null)
  const pendingRef = useRef<PendingPick | null>(null)
  const [creation, setCreation] = useState<Creation | null>(null)

  const open = useCallback(
    (options: PickerView) =>
      new Promise<Picked>(resolve => {
        pendingRef.current?.resolve(null)
        const next = { ...options, resolve }
        pendingRef.current = next
        setPending(next)
        setCreation(null)
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
    setCreation(null)
  }

  // What the picker lists: the folders asked for, or where the folder
  // created goes, as the folder actions ask it ("All folders" first)
  const creationStage = creation?.stage ?? null
  const creationParentId = creation?.parentId ?? null
  const view = useMemo((): PickerView | null => {
    if (pending === null || creationStage === null) return pending
    if (creationStage !== 'parent') return null
    return {
      title: t('mailboxPicker.selectParent'),
      rootLabel: t('mailboxPicker.allFolders'),
      personalOnly: true,
      currentId: creationParentId ?? PICKED_ROOT
    }
  }, [pending, creationStage, creationParentId, t])

  const sections = useMemo((): FolderPickerSection[] => {
    if (view === null) return []
    const disabled = new Set(view.disabledIds ?? [])
    const { personal, team, shared } = buildMailboxSections(mailboxes, false)
    const { system, folders } = splitPersonalTree(personal)
    const excludedRoles = view.excludedRoles ?? []
    const toOptions = (trees: readonly MailboxNode[]): FolderPickerOption[] =>
      listVisibleMailboxes(
        pruneMailboxRoles(trees, excludedRoles),
        () => true
      ).map(({ mailbox, level, hasChildren }): FolderPickerOption => {
        const isRoot = isTeamRoot(mailbox)
        return {
          id: mailbox.id,
          label: getName(mailbox),
          // Searched by its path; a team mailbox by its address too
          secondary: mailboxPath(mailboxes, mailbox.id, getName),
          // As tmail-flutter: a team mailbox shows its address, no icon
          // and a folder another user shares, the address of its owner
          subtitle: isRoot
            ? (teamMailboxAddress(mailbox) ?? mailbox.name)
            : isSharedRoot(mailbox)
              ? sharedMailboxOwner(mailbox)
              : null,
          level,
          parentId: mailbox.parentId,
          hasChildren,
          icon: isRoot ? null : getMailboxIcon(mailbox),
          isCurrent: mailbox.id === view.currentId,
          disabled:
            (isRoot && view.isTeamRootPickable !== true) ||
            disabled.has(mailbox.id) ||
            (view.requireAddItems === true && !mailbox.myRights.mayAddItems)
        }
      })
    const rootLabel = view.rootLabel
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
              isCurrent: view.currentId === PICKED_ROOT,
              disabled: view.isRootDisabled === true
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
      isCurrent: view.currentId === choice.id
    })
    const choices = view.choices ?? []
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
      ...(view.personalOnly === true
        ? []
        : [
            {
              id: 'team',
              label: t('sidebar.teamMailboxes'),
              options: toOptions(team)
            },
            {
              id: 'shared',
              label: t('sidebar.otherUsers'),
              options: toOptions(shared)
            }
          ])
    ]
  }, [mailboxes, getName, view, t])

  // The way to the folder concerned (or the first one left out, the folder
  // to move), unfolded
  const expandedIds = useMemo((): string[] => {
    const currentId = view?.currentId ?? view?.disabledIds?.[0]
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
  }, [mailboxes, view])

  const handleSelect = (option: FolderPickerOption): void => {
    if (creation !== null) {
      // Where the folder created goes
      setCreation({
        parentId: option.id === ROOT_OPTION_ID ? null : option.id,
        stage: 'name'
      })
      return
    }
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
    if (creation !== null) {
      setCreation({ ...creation, stage: 'name' })
      return
    }
    close(null)
  }

  const handleCreate = async (
    name: string,
    parentId: string | null
  ): Promise<void> => {
    const asked = pendingRef.current
    setCreation({ parentId, stage: 'saving' })
    const created = await createFolder(name, parentId)
    // Another pick started meanwhile
    if (pendingRef.current !== asked) return
    if (created === null) setCreation(null)
    else close(created)
  }

  return (
    <PickMailboxContext.Provider value={context}>
      {children}
      <FolderPicker
        // A picker of its own for where the folder created goes, mounted
        // over the dialog naming it: reopened, the first one would stay
        // hidden from assistive technologies behind that dialog
        key={creationStage === 'parent' ? 'parent' : 'pick'}
        open={view !== null}
        labels={{
          title: view?.title ?? t('mailboxPicker.title'),
          close: t('common.close'),
          search: t('mailboxPicker.search'),
          empty: t('mailboxPicker.empty'),
          collapsed: t('mailboxPicker.collapsed'),
          expanded: t('mailboxPicker.expanded'),
          current: view?.currentLabel ?? t('mailboxPicker.current'),
          create: t('folders.newFolder')
        }}
        sections={sections}
        initiallyExpandedIds={expandedIds}
        onSelect={handleSelect}
        onClose={handleClose}
        onCreate={
          view?.canCreateFolder === true
            ? () => {
                setCreation({ parentId: null, stage: 'name' })
              }
            : null
        }
        testIds={{
          dialog: 'mailbox-picker',
          close: 'mailbox-picker-close-button',
          create: 'mailbox-picker-new-folder-button',
          input: 'mailbox-picker-search-input',
          listbox: 'mailbox-picker-list',
          option: 'mailbox-picker-item'
        }}
      />
      {creation === null || creation.stage === 'saving' ? null : (
        <MailboxNameDialog
          title={t('folders.create.title')}
          submitLabel={t('folders.create.submit')}
          initialName=""
          location={{
            path:
              creation.parentId === null
                ? t('mailboxPicker.allFolders')
                : mailboxPath(mailboxes, creation.parentId, getName),
            onChange: () => {
              setCreation({ ...creation, stage: 'parent' })
            }
          }}
          validate={name =>
            validateFolderName(name, {
              mailboxes,
              parentId: creation.parentId
            })
          }
          onSubmit={name => {
            void handleCreate(name, creation.parentId)
          }}
          onClose={() => {
            // Back to the folders
            setCreation(null)
          }}
        />
      )}
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
