import type { ReactElement } from 'react'

import { NEEDS_ACTION, hasKeyword } from '@common/features/email/keywords'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { useI18n } from '@common/i18n/useI18n'

import { ActionRequiredTag } from './ActionRequiredTag'
import { useAiNeedsActionEnabled } from './aiNeedsAction'

export interface EmailActionRequiredTagProps {
  /** An email, or the emails of a conversation */
  emails: readonly TargetEmail[]
  /** The folder the emails are shown in, null elsewhere */
  mailboxId: string | null
}

/**
 * The "Action required" tag of an opened email or conversation (on any of
 * its emails), on the line of its subject, with a × taking the
 * `needs-action` keyword off all of them (tmail-flutter `EmailSubjectWidget`,
 * `onRemoveNeedsActionKeyword`). Nothing without the feature.
 */
export function EmailActionRequiredTag({
  emails,
  mailboxId
}: EmailActionRequiredTagProps): ReactElement | null {
  const { t } = useI18n()
  const isEnabled = useAiNeedsActionEnabled()
  const { run } = useEmailActions()
  const needingAction = emails.filter(email => hasKeyword(email, NEEDS_ACTION))
  if (!isEnabled || needingAction.length === 0) return null

  const handleRemove = (): void => {
    void run({
      action: 'removeLabel',
      emails: needingAction,
      mailboxId,
      label: { keyword: NEEDS_ACTION, displayName: t('email.actionRequired') }
    })
  }

  return <ActionRequiredTag onRemove={handleRemove} />
}
