import type { MailboxSummary } from './queries'

export interface MailboxNode {
  mailbox: MailboxSummary
  children: MailboxNode[]
}

/** A row of the folder tree as displayed: the expanded part of the tree */
export interface VisibleMailbox {
  mailbox: MailboxSummary
  /** 1 for the top level, as `aria-level` */
  level: number
  hasChildren: boolean
  isExpanded: boolean
  /** Position among its siblings, from 1, as `aria-posinset` */
  position: number
  siblingCount: number
}

/**
 * The order of the system folders when the server gives them the same
 * `sortOrder`, and of the system folders of a team mailbox, as in
 * tmail-flutter (`MailboxTreeBuilder._systemFolderRoleIndex`). The personal
 * ones follow the server `sortOrder` first, as tmail-flutter's default tree
 * (tmail-backend: Inbox, Sent, Archive, Drafts, Outbox, Trash, Spam,
 * Templates).
 */
export const SYSTEM_ROLE_ORDER: readonly string[] = [
  'inbox',
  'drafts',
  'outbox',
  'sent',
  'trash',
  'junk',
  'templates',
  'archive'
]

/**
 * The system folders of a team mailbox have no role: tmail-flutter knows
 * them by name, in this order
 */
const TEAM_SYSTEM_NAMES: readonly string[] = [
  'inbox',
  'drafts',
  'outbox',
  'sent',
  'trash',
  'spam',
  'junk',
  'templates',
  'archive'
]

/** A mailbox of the user, not shared with them (team mailboxes) */
export function isPersonalMailbox(
  mailbox: Pick<MailboxSummary, 'namespace'>
): boolean {
  return (
    mailbox.namespace === null ||
    mailbox.namespace === undefined ||
    mailbox.namespace === 'Personal'
  )
}

/**
 * The address of the team mailbox a folder belongs to: what its namespace
 * holds between brackets (`TeamMailbox[team@example.com]`), else the whole
 * namespace, as tmail-flutter's `emailTeamMailBoxes`; null for a folder of
 * the user. Every folder of a team mailbox has the namespace of its root.
 */
export function teamMailboxAddress(
  mailbox: Pick<MailboxSummary, 'namespace'>
): string | null {
  if (isPersonalMailbox(mailbox)) return null
  const namespace = mailbox.namespace ?? ''
  const open = namespace.indexOf('[')
  const close = namespace.indexOf(']', open)
  const address =
    open > 0 && close > open ? namespace.slice(open + 1, close) : namespace
  return address === '' ? null : address
}

/** The root of a team mailbox: a folder of another namespace without parent */
export function isTeamRoot(
  mailbox: Pick<MailboxSummary, 'namespace' | 'parentId'>
): boolean {
  return !isPersonalMailbox(mailbox) && mailbox.parentId === null
}

/** A folder of a team mailbox, not its root */
export function isTeamFolder(
  mailbox: Pick<MailboxSummary, 'namespace' | 'parentId'>
): boolean {
  return !isPersonalMailbox(mailbox) && mailbox.parentId !== null
}

type NamedMailbox = Pick<
  MailboxSummary,
  'namespace' | 'parentId' | 'name' | 'role'
>

/**
 * A system folder of a team mailbox, known by its name (they have no role),
 * as tmail-flutter does: at any depth, `isChildOfTeamMailboxes` and the name
 */
function isTeamFolderNamed(mailbox: NamedMailbox, name: string): boolean {
  return (
    isTeamFolder(mailbox) &&
    mailbox.role === null &&
    mailbox.name.toLowerCase() === name
  )
}

/** The Inbox of a team mailbox: no role, known by its name ("INBOX") */
export function isTeamInbox(mailbox: NamedMailbox): boolean {
  return isTeamFolderNamed(mailbox, 'inbox')
}

/** The Trash of a team mailbox: no role, known by its name */
export function isTeamTrash(mailbox: NamedMailbox): boolean {
  return isTeamFolderNamed(mailbox, 'trash')
}

/** The Drafts of a team mailbox: no role, known by its name */
export function isTeamDrafts(mailbox: NamedMailbox): boolean {
  return isTeamFolderNamed(mailbox, 'drafts')
}

/** The Templates of a team mailbox: no role, known by its name */
export function isTeamTemplates(mailbox: NamedMailbox): boolean {
  return isTeamFolderNamed(mailbox, 'templates')
}

/** The Trash of the user or of a team mailbox */
export function isTrashMailbox(mailbox: NamedMailbox): boolean {
  return mailbox.role === 'trash' || isTeamTrash(mailbox)
}

/** The Drafts of the user or of a team mailbox */
export function isDraftsMailbox(mailbox: NamedMailbox): boolean {
  return mailbox.role === 'drafts' || isTeamDrafts(mailbox)
}

/**
 * Whether a folder is directly under the root of its team mailbox
 * (Team/Trash, not Team/Project/Trash), as tmail-flutter's
 * `isFirstLevelTeamSystemFolder`
 */
export function isFirstLevelTeamFolder(
  mailbox: Pick<MailboxSummary, 'namespace' | 'parentId'>,
  mailboxes: readonly Pick<MailboxSummary, 'id' | 'namespace' | 'parentId'>[]
): boolean {
  if (!isTeamFolder(mailbox)) return false
  const parent = mailboxes.find(candidate => candidate.id === mailbox.parentId)
  return parent !== undefined && isTeamRoot(parent)
}

/**
 * The Trash and Spam folders of the user and the Trash of every team
 * mailbox, which a search leaves out by default (tmail-flutter
 * `trashSpamMailboxIds`)
 */
export function findTrashAndSpamIds(
  mailboxes: readonly MailboxSummary[]
): string[] {
  return mailboxes
    .filter(mailbox => isTrashMailbox(mailbox) || mailbox.role === 'junk')
    .map(mailbox => mailbox.id)
}

/**
 * The folders of each team mailbox, by the id of its root, its Trash and
 * Spam left out as in the default search: what a search in a team mailbox
 * looks in, its root holding no email
 */
export function findTeamFolderIds(
  mailboxes: readonly MailboxSummary[]
): Record<string, string[]> {
  const trashAndSpam = new Set(findTrashAndSpamIds(mailboxes))
  return Object.fromEntries(
    mailboxes.filter(isTeamRoot).map((root): [string, string[]] => [
      root.id,
      findDescendantIds(mailboxes, root.id)
        .filter(id => !trashAndSpam.has(id))
        .sort()
    ])
  )
}

function roleRank(mailbox: MailboxSummary, isUnderTeamRoot: boolean): number {
  if (!isPersonalMailbox(mailbox)) {
    // Under the root of a team mailbox, its system folders come first, known
    // by name; everywhere else in a team mailbox the order is the name
    const index =
      isUnderTeamRoot && mailbox.role === null
        ? TEAM_SYSTEM_NAMES.indexOf(mailbox.name.toLowerCase())
        : -1
    return index === -1 ? SYSTEM_ROLE_ORDER.length : index
  }
  // Personal: the system folders first, among them the server's order
  return mailbox.role ? 0 : SYSTEM_ROLE_ORDER.length
}

function personalRoleIndex(mailbox: MailboxSummary): number {
  if (!isPersonalMailbox(mailbox) || mailbox.role === null) return 0
  const index = SYSTEM_ROLE_ORDER.indexOf(mailbox.role)
  return index === -1 ? SYSTEM_ROLE_ORDER.length : index
}

/**
 * Sibling order: system folders first, then the server `sortOrder`, then the
 * role (inbox, drafts, sent…), then the name. In a team mailbox the system folders under its
 * root come first, by name, and everything else is by name, as tmail-flutter
 * (`_applyTeamMailboxSorting`).
 */
export function compareMailboxes(
  left: MailboxSummary,
  right: MailboxSummary,
  isUnderTeamRoot = false
): number {
  return (
    roleRank(left, isUnderTeamRoot) - roleRank(right, isUnderTeamRoot) ||
    (isPersonalMailbox(left) ? left.sortOrder : 0) -
      (isPersonalMailbox(right) ? right.sortOrder : 0) ||
    personalRoleIndex(left) - personalRoleIndex(right) ||
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
    left.id.localeCompare(right.id)
  )
}

function sortTree(
  nodes: MailboxNode[],
  isUnderTeamRoot = false
): MailboxNode[] {
  nodes.sort((left, right) =>
    compareMailboxes(left.mailbox, right.mailbox, isUnderTeamRoot)
  )
  nodes.forEach(node => sortTree(node.children, isTeamRoot(node.mailbox)))
  return nodes
}

/** Whether `ancestorId` is `mailboxId` or one of its ancestors */
function isSelfOrAncestor(
  ancestorId: string,
  mailboxId: string,
  byId: ReadonlyMap<string, MailboxSummary>
): boolean {
  const seen = new Set<string>()
  let current: string | null = mailboxId
  while (current !== null && !seen.has(current)) {
    if (current === ancestorId) return true
    seen.add(current)
    current = byId.get(current)?.parentId ?? null
  }
  return false
}

/**
 * Nests the mailboxes under their `parentId` and sorts every level. A
 * mailbox whose parent is missing, or which would close a cycle, is shown
 * at the top level rather than lost.
 */
export function buildMailboxTree(
  mailboxes: readonly MailboxSummary[]
): MailboxNode[] {
  const byId = new Map(mailboxes.map(mailbox => [mailbox.id, mailbox]))
  const nodes = new Map<string, MailboxNode>(
    mailboxes.map(mailbox => [mailbox.id, { mailbox, children: [] }])
  )
  const roots: MailboxNode[] = []

  for (const node of nodes.values()) {
    const { id, parentId } = node.mailbox
    const parent = parentId === null ? undefined : nodes.get(parentId)
    if (parent && parentId !== null && !isSelfOrAncestor(id, parentId, byId)) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return sortTree(roots)
}

/** The ids of the ancestors of a mailbox, closest first */
export function findAncestorIds(
  mailboxes: readonly MailboxSummary[],
  mailboxId: string
): string[] {
  const byId = new Map(mailboxes.map(mailbox => [mailbox.id, mailbox]))
  const ancestors: string[] = []
  let parentId = byId.get(mailboxId)?.parentId ?? null
  while (parentId !== null && !ancestors.includes(parentId)) {
    ancestors.push(parentId)
    parentId = byId.get(parentId)?.parentId ?? null
  }
  return ancestors
}

/**
 * The rows to display, depth first: the children of a collapsed folder are
 * left out.
 */
export function listVisibleMailboxes(
  tree: readonly MailboxNode[],
  isExpanded: (mailboxId: string) => boolean,
  level = 1
): VisibleMailbox[] {
  return tree.flatMap((node, index) => {
    const hasChildren = node.children.length > 0
    const expanded = hasChildren && isExpanded(node.mailbox.id)
    const row: VisibleMailbox = {
      mailbox: node.mailbox,
      level,
      hasChildren,
      isExpanded: expanded,
      position: index + 1,
      siblingCount: tree.length
    }
    return expanded
      ? [row, ...listVisibleMailboxes(node.children, isExpanded, level + 1)]
      : [row]
  })
}

/** The id of the mailbox of a role, e.g. the inbox, null if there is none */
/** The name of the Templates folder tmail-flutter creates (no role) */
export const TEMPLATES_NAME = 'Templates'

/**
 * The Templates folder of the user: the `templates` role of tmail-flutter,
 * or, as the folder it creates has no role on James, a personal top-level
 * folder named "Templates", whatever its case
 */
export function isTemplatesMailbox(
  mailbox: Pick<MailboxSummary, 'role' | 'name' | 'namespace' | 'parentId'>
): boolean {
  if (mailbox.role === 'templates') return true
  return (
    mailbox.role === null &&
    mailbox.parentId === null &&
    isPersonalMailbox(mailbox) &&
    mailbox.name.toLowerCase() === TEMPLATES_NAME.toLowerCase()
  )
}

/** The Templates folder, null before it is created */
export function findTemplatesMailboxId(
  mailboxes: readonly MailboxSummary[]
): string | null {
  return (
    mailboxes.find(mailbox => mailbox.role === 'templates')?.id ??
    mailboxes.find(isTemplatesMailbox)?.id ??
    null
  )
}

export function findMailboxIdByRole(
  mailboxes: readonly MailboxSummary[],
  role: string
): string | null {
  return mailboxes.find(mailbox => mailbox.role === role)?.id ?? null
}

/**
 * The path of a mailbox, from the top level, as tmail-flutter shows it in
 * its toasts: `Archive`, `Work/Clients`
 */
export function mailboxPath(
  mailboxes: readonly MailboxSummary[],
  mailboxId: string,
  getName: (mailbox: MailboxSummary) => string
): string {
  const byId = new Map(mailboxes.map(mailbox => [mailbox.id, mailbox]))
  const mailbox = byId.get(mailboxId)
  if (mailbox === undefined) return ''
  return [...findAncestorIds(mailboxes, mailboxId).reverse(), mailboxId]
    .flatMap(id => {
      const node = byId.get(id)
      return node === undefined ? [] : [getName(node)]
    })
    .join('/')
}

/** The descendants of a mailbox, the deepest first */
export function findDescendantIds(
  mailboxes: readonly MailboxSummary[],
  mailboxId: string
): string[] {
  const seen = new Set<string>([mailboxId])
  const children = (parentId: string): string[] =>
    mailboxes
      .filter(mailbox => mailbox.parentId === parentId && !seen.has(mailbox.id))
      .flatMap(mailbox => {
        seen.add(mailbox.id)
        return [...children(mailbox.id), mailbox.id]
      })
  return children(mailboxId)
}

/**
 * A folder the user hid (`isSubscribed: false`), as tmail-flutter: personal
 * folders without a role, and the roots of team mailboxes
 */
export function isHiddenMailbox(mailbox: MailboxSummary): boolean {
  if (mailbox.isSubscribed) return false
  return isPersonalMailbox(mailbox)
    ? mailbox.role === null
    : mailbox.parentId === null
}

export interface MailboxTreeSections {
  /** The folders of the user */
  personal: MailboxNode[]
  /** One root per team mailbox, its folders under it */
  team: MailboxNode[]
  /** How many folders are hidden, with their subfolders */
  hiddenCount: number
}

/**
 * The trees of the sidebar: the personal folders, then the team mailboxes.
 * Hidden folders and their subfolders are left out, unless `showHidden`.
 */
export function buildMailboxSections(
  mailboxes: readonly MailboxSummary[],
  showHidden: boolean
): MailboxTreeSections {
  const hidden = new Set<string>()
  for (const mailbox of mailboxes) {
    if (!isHiddenMailbox(mailbox)) continue
    hidden.add(mailbox.id)
    findDescendantIds(mailboxes, mailbox.id).forEach(id => hidden.add(id))
  }
  const shown = showHidden
    ? mailboxes
    : mailboxes.filter(mailbox => !hidden.has(mailbox.id))
  return {
    personal: buildMailboxTree(shown.filter(isPersonalMailbox)),
    team: buildMailboxTree(
      shown.filter(mailbox => !isPersonalMailbox(mailbox))
    ),
    hiddenCount: hidden.size
  }
}

/**
 * A top-level folder of the user that belongs to the system block of the
 * sidebar (Inbox, Drafts, Archive…, the Templates folder tmail-flutter
 * creates), as opposed to the "Folders" the user made
 */
export function isSystemRoot(mailbox: MailboxSummary): boolean {
  return mailbox.role !== null || isTemplatesMailbox(mailbox)
}

export interface PersonalTrees {
  /** The system folders, in the order of tmail-flutter, Templates included */
  system: MailboxNode[]
  /** The folders the user made */
  folders: MailboxNode[]
}

/**
 * Splits the roots of the personal tree in the two blocks of the design: the
 * system folders, above the "Folders" section, and the user's folders
 * (tmail-flutter's `exchange` and `personalFolders` categories)
 */
export function splitPersonalTree(
  roots: readonly MailboxNode[]
): PersonalTrees {
  const rank = (mailbox: MailboxSummary): number => {
    const index = SYSTEM_ROLE_ORDER.indexOf(
      mailbox.role ?? (isTemplatesMailbox(mailbox) ? 'templates' : '')
    )
    return index === -1 ? SYSTEM_ROLE_ORDER.length : index
  }
  const system = roots.filter(node => isSystemRoot(node.mailbox))
  // The server's order, then the role (Array.prototype.sort is stable)
  system.sort(
    (left, right) =>
      left.mailbox.sortOrder - right.mailbox.sortOrder ||
      rank(left.mailbox) - rank(right.mailbox)
  )
  return {
    system,
    folders: roots.filter(node => !isSystemRoot(node.mailbox))
  }
}

/**
 * The folder of a team mailbox an email is in, null for an email of the
 * user
 */
export function findTeamHomeId(
  mailboxes: readonly MailboxSummary[],
  email: { mailboxIds: Readonly<Record<string, true>> }
): string | null {
  return (
    Object.keys(email.mailboxIds).find(id => {
      const mailbox = mailboxes.find(candidate => candidate.id === id)
      return mailbox !== undefined && !isPersonalMailbox(mailbox)
    }) ?? null
  )
}

/**
 * A folder of the team mailbox `mailboxId` belongs to, by name (team
 * folders have no role): its Trash, its Drafts
 */
export function findTeamFolderId(
  mailboxes: readonly MailboxSummary[],
  mailboxId: string,
  name: string
): string | null {
  const ancestors = findAncestorIds(mailboxes, mailboxId)
  const rootId = ancestors[ancestors.length - 1] ?? mailboxId
  return (
    mailboxes.find(
      mailbox =>
        mailbox.parentId === rootId &&
        mailbox.name.toLowerCase() === name.toLowerCase()
    )?.id ?? null
  )
}

/**
 * The folder of the team mailbox whose address is `address`, by name
 * (Drafts, Sent: team folders have no role); null when there is none
 */
export function findTeamFolderByAddress(
  mailboxes: readonly MailboxSummary[],
  address: string,
  name: string
): string | null {
  const wanted = address.trim().toLowerCase()
  return (
    mailboxes.find(
      mailbox =>
        isTeamFolder(mailbox) &&
        mailbox.name.toLowerCase() === name &&
        teamMailboxAddress(mailbox)?.toLowerCase() === wanted
    )?.id ?? null
  )
}
