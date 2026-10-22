import { Email, FolderMoveto } from '@linagora/twake-icons'
import { useCallback } from 'react'

import { usePickFolderOrChoice } from '@common/features/mailbox/MailboxPickerProvider'
import { isTeamFolder, mailboxPath } from '@common/features/mailbox/mailboxTree'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useI18n } from '@common/i18n/useI18n'

import type { SearchFilter } from './searchFilter'

type Scope = SearchFilter['scope']

/** The scopes listed before the folders; not mailbox ids: they hold a space */
const DEFAULT_SCOPE_ID = 'all email'
const EVERYWHERE_SCOPE_ID = 'all email trash spam'

/**
 * Picks the scope of a search as tmail-flutter does: the destination
 * picker, "All email" and "All Email, trash & spam" before the folders, the
 * current scope marked. Resolves to null when the picker is closed
 */
export function usePickSearchScope(): (
  current: Scope
) => Promise<Scope | null> {
  const { t } = useI18n()
  const pickFolderOrChoice = usePickFolderOrChoice()
  return useCallback(
    async (current: Scope): Promise<Scope | null> => {
      const picked = await pickFolderOrChoice({
        title: t('search.selectFolder'),
        currentLabel: t('search.scope.selected'),
        // A team mailbox searched as a whole: all its folders but Trash
        isTeamRootPickable: true,
        currentId:
          current.kind === 'mailbox'
            ? current.mailboxId
            : current.kind === 'everywhere'
              ? EVERYWHERE_SCOPE_ID
              : DEFAULT_SCOPE_ID,
        choices: [
          {
            id: DEFAULT_SCOPE_ID,
            label: t('search.scope.default'),
            icon: Email
          },
          {
            id: EVERYWHERE_SCOPE_ID,
            label: t('search.scope.everywhere'),
            icon: FolderMoveto,
            placement: 'section'
          }
        ]
      })
      if (picked === null) return null
      if ('icon' in picked) {
        return {
          kind: picked.id === EVERYWHERE_SCOPE_ID ? 'everywhere' : 'default'
        }
      }
      return { kind: 'mailbox', mailboxId: picked.id }
    },
    [pickFolderOrChoice, t]
  )
}

/**
 * The name of a search scope: its folder, "All email"… A folder of a team
 * mailbox goes with the team mailbox ("bob-guests/Inbox"), to tell it from
 * the personal one
 */
export function useSearchScopeLabel(): (scope: Scope) => string {
  const { t } = useI18n()
  const mailboxes = useMailboxes().data
  const getName = useMailboxName()
  return useCallback(
    (scope: Scope): string => {
      if (scope.kind !== 'mailbox') {
        return t(
          scope.kind === 'everywhere'
            ? 'search.scope.everywhere'
            : 'search.scope.default'
        )
      }
      const mailbox = mailboxes?.find(({ id }) => id === scope.mailboxId)
      if (mailbox === undefined) return t('search.fields.folder')
      return isTeamFolder(mailbox)
        ? mailboxPath(mailboxes ?? [], mailbox.id, getName)
        : getName(mailbox)
    },
    [mailboxes, getName, t]
  )
}
