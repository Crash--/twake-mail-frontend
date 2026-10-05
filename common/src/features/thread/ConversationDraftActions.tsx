import { Box, Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { formatAddressNames } from '@common/features/email/addresses'
import type { EmailDetail } from '@common/features/email/queries'
import type { EmailActionId } from '@common/features/emailActions/emailActionItems'
import { useRemoveEmails } from '@common/features/emailActions/useRemoveEmails'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { useI18n } from '@common/i18n/useI18n'

export interface ConversationDraftActionsProps {
  draft: EmailDetail
  /** The folder of the draft (Drafts) */
  mailboxId: string | null
  /** After the draft was deleted */
  onAction: (id: EmailActionId) => void
}

/**
 * What a draft of a conversation offers instead of the answers of a
 * message (tmail-flutter opens a draft in the composer): edit it in the
 * composer, or delete it forever. The buttons are named after who the
 * draft is for, the subject of a conversation telling its drafts apart from
 * nothing.
 */
export function ConversationDraftActions({
  draft,
  mailboxId,
  onAction
}: ConversationDraftActionsProps): ReactElement {
  const { t } = useI18n()
  const { openComposer } = useComposer()
  const removeEmails = useRemoveEmails()
  const recipients = formatAddressNames([
    ...(draft.to ?? []),
    ...(draft.cc ?? []),
    ...(draft.bcc ?? [])
  ])

  const handleEdit = (): void => {
    // The draft locks keep it to one composer
    openComposer({ draftId: draft.id })
  }

  const handleDelete = (): void => {
    removeEmails([draft], mailboxId)
      .then(isDeleted => {
        if (isDeleted) onAction('delete-permanently')
      })
      .catch((error: unknown) => {
        console.warn('[thread] Cannot delete the draft', error)
      })
  }

  return (
    <Box
      role="group"
      aria-label={t('thread.draft.actions')}
      className="u-flex u-flex-wrap u-mt-1"
      data-testid="conversation-draft-actions"
    >
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        onClick={handleEdit}
        aria-label={
          recipients === ''
            ? undefined
            : t('thread.draft.editTo', { recipients })
        }
        className="u-mr-half u-mb-half"
        data-testid="conversation-draft-edit-button"
      >
        {t('thread.draft.edit')}
      </Button>
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        onClick={handleDelete}
        aria-label={
          recipients === ''
            ? undefined
            : t('thread.draft.deleteTo', { recipients })
        }
        className="u-mr-half u-mb-half"
        data-testid="conversation-draft-delete-button"
      >
        {t('thread.draft.delete')}
      </Button>
    </Box>
  )
}
