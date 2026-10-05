import type { ReactElement } from 'react'

import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'

import { useLabelActions } from './LabelActionsProvider'
import { LabelChips, labelsOfEmail } from './LabelChips'
import { useLabels, useLabelsAvailable } from './queries'

export interface EmailLabelsProps {
  /** An email, or the emails of a conversation */
  emails: readonly TargetEmail[]
  /** The folder the emails are shown in, null elsewhere */
  mailboxId: string | null
}

/**
 * The labels of an opened email or conversation (on any of its emails),
 * under its subject, each with a × taking it off all of them
 * (tmail-flutter `EmailSubjectWidget`, thread label actions)
 */
export function EmailLabels({
  emails,
  mailboxId
}: EmailLabelsProps): ReactElement | null {
  const isAvailable = useLabelsAvailable()
  const labels = useLabels().data?.list ?? []
  const { takeOff } = useLabelActions()
  if (!isAvailable) return null
  const shown = labels.filter(label =>
    emails.some(email => labelsOfEmail([label], email).length > 0)
  )
  return (
    <LabelChips
      className="u-mt-half"
      labels={shown}
      onRemove={label => {
        void takeOff(
          label,
          emails.filter(email => label.keyword in email.keywords),
          mailboxId
        )
      }}
    />
  )
}
