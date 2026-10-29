import type { EmailActionId } from '@common/features/emailActions/emailActionItems'

/**
 * The emails the reading view is moving out of their folder (archive,
 * trash, move, spam…), noted before the action runs: once they leave it,
 * the view tells the user's own move, which follows the "After deleting or
 * moving an email" preference, from a move by another client or tab, which
 * goes back to the list.
 */
const moving = new Set<string>()

/** The actions of the view that take an email out of its folder */
const LEAVING_ACTIONS: readonly EmailActionId[] = [
  'not-spam',
  'move-to-trash',
  'delete-permanently',
  'archive',
  'move',
  'mark-as-spam'
]

export function noteMoveFromView(emailIds: readonly string[]): void {
  emailIds.forEach(id => moving.add(id))
}

/** The action did not run (cancelled, refused): the email stays */
export function forgetMoveFromView(emailIds: readonly string[]): void {
  emailIds.forEach(id => moving.delete(id))
}

/**
 * Whether one of the emails, gone from the folder, was moved by the view;
 * forgets them
 */
export function takeMoveFromView(emailIds: readonly string[]): boolean {
  return emailIds
    .map(id => moving.delete(id))
    .reduce((wasMoved, deleted) => wasMoved || deleted, false)
}

/**
 * Runs an action of the view on `emailIds`, noted as a move of the view
 * when it takes them out of their folder (until it turns out not to run)
 */
export async function runFromView(
  id: EmailActionId,
  emailIds: readonly string[],
  runAction: () => Promise<boolean>
): Promise<boolean> {
  if (!LEAVING_ACTIONS.includes(id)) return runAction()
  noteMoveFromView(emailIds)
  const done = await runAction()
  if (!done) forgetMoveFromView(emailIds)
  return done
}
