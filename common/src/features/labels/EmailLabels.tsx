import type { ReactElement } from 'react'

import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'

import { useLabelActions } from './LabelActionsProvider'
import { LabelChips, labelsOfEmail } from './LabelChips'
import { useLabels, useLabelsAvailable } from './queries'

export interface EmailLabelsProps {
  email: TargetEmail
  /** The folder the email is shown in, null elsewhere */
  mailboxId: string | null
}

/**
 * The labels of an opened email, under its subject, each with a ×
 * taking it off (tmail-flutter `EmailSubjectWidget`)
 */
export function EmailLabels({
  email,
  mailboxId
}: EmailLabelsProps): ReactElement | null {
  const isAvailable = useLabelsAvailable()
  const labels = useLabels().data?.list ?? []
  const { takeOff } = useLabelActions()
  if (!isAvailable) return null
  return (
    <LabelChips
      className="u-mt-half"
      labels={labelsOfEmail(labels, email)}
      onRemove={label => {
        void takeOff(label, [email], mailboxId)
      }}
    />
  )
}
