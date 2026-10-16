import { Icon } from '@linagora/twake-icons'
import { Tooltip } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { BadSignature, GoodSignature } from '@/ds/FlutterIcons/FlutterIcons'
import { useI18n } from '@common/i18n/useI18n'

import type { SmimeStatus } from './smimeStatus'

export interface SmimeStatusMarkProps {
  status: SmimeStatus
}

const MARKS = {
  good: {
    icon: GoodSignature,
    label: 'email.smime.good',
    testId: 'email-smime-good-signature'
  },
  bad: {
    icon: BadSignature,
    label: 'email.smime.bad',
    testId: 'email-smime-bad-signature'
  }
} as const

/**
 * As tmail-flutter, next to the sender: a good or bad signature icon, its
 * meaning in a tooltip and as the name of the image (not by colour alone).
 * Nothing for an email that is not signed.
 */
export function SmimeStatusMark({
  status
}: SmimeStatusMarkProps): ReactElement | null {
  const { t } = useI18n()
  if (status === 'not-signed') return null
  const { icon, label, testId } = MARKS[status]
  const text = t(label)
  return (
    <Tooltip title={text}>
      <span
        role="img"
        aria-label={text}
        className="u-flex u-flex-items-center u-flex-shrink-0"
        data-testid={testId}
      >
        <Icon icon={icon} size={16} aria-hidden="true" />
      </span>
    </Tooltip>
  )
}
