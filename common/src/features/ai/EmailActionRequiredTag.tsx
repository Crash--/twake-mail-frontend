import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { NEEDS_ACTION, hasKeyword } from '@common/features/email/keywords'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { useI18n } from '@common/i18n/useI18n'

import { ActionRequiredTag } from './ActionRequiredTag'
import { useAiNeedsActionEnabled } from './aiNeedsAction'

export interface EmailActionRequiredTagProps {
  email: TargetEmail
  /** The folder the email is shown in, null elsewhere */
  mailboxId: string | null
}

/**
 * The "Action required" tag of an opened email, under its subject, with a ×
 * taking the `needs-action` keyword off (tmail-flutter `EmailSubjectWidget`,
 * `onRemoveNeedsActionKeyword`). Nothing without the feature.
 */
export function EmailActionRequiredTag({
  email,
  mailboxId
}: EmailActionRequiredTagProps): ReactElement | null {
  const { t } = useI18n()
  const isEnabled = useAiNeedsActionEnabled()
  const { run } = useEmailActions()
  if (!isEnabled || !hasKeyword(email, NEEDS_ACTION)) return null

  const handleRemove = (): void => {
    void run({
      action: 'removeLabel',
      emails: [email],
      mailboxId,
      label: { keyword: NEEDS_ACTION, displayName: t('email.actionRequired') }
    })
  }

  return (
    <Box className="u-mt-half" data-testid="action-required-tag-bar">
      <ActionRequiredTag onRemove={handleRemove} />
    </Box>
  )
}
