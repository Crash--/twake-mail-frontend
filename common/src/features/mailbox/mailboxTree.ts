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

function roleRank(mailbox: MailboxSummary): number {
  const index = mailbox.role ? SYSTEM_ROLE_ORDER.indexOf(mailbox.role) : -1
  return index === -1 ? SYSTEM_ROLE_ORDER.length : index
}

/**
 * Sibling order: system roles first (inbox, drafts, sent…), then the
 * server `sortOrder`, then the name.
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
