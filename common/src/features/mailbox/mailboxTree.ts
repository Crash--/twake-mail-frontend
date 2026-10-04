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
 * System folders come first, in this order, as in tmail-flutter
 * (`MailboxTreeBuilder._systemFolderRoleIndex`).
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

/** The Trash of a team mailbox: no role, known by its name */
export function isTeamTrash(
  mailbox: Pick<MailboxSummary, 'namespace' | 'name' | 'role'>
): boolean {
  return (
    !isPersonalMailbox(mailbox) &&
    mailbox.role === null &&
    mailbox.name.toLowerCase() === 'trash'
  )
}

function roleRank(mailbox: MailboxSummary): number {
  if (mailbox.role === null && !isPersonalMailbox(mailbox)) {
    const index = TEAM_SYSTEM_NAMES.indexOf(mailbox.name.toLowerCase())
    return index === -1 ? SYSTEM_ROLE_ORDER.length : index
  }
  const index = mailbox.role ? SYSTEM_ROLE_ORDER.indexOf(mailbox.role) : -1
  return index === -1 ? SYSTEM_ROLE_ORDER.length : index
}

/**
 * Sibling order: system roles first (inbox, drafts, sent…; by name in team
 * mailboxes), then the server `sortOrder`, then the name.
 */
export function compareMailboxes(
  left: MailboxSummary,
  right: MailboxSummary
): number {
  return (
    roleRank(left) - roleRank(right) ||
    left.sortOrder - right.sortOrder ||
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
    left.id.localeCompare(right.id)
  )
}

function sortTree(nodes: MailboxNode[]): MailboxNode[] {
  nodes.sort((left, right) => compareMailboxes(left.mailbox, right.mailbox))
  nodes.forEach(node => sortTree(node.children))
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
