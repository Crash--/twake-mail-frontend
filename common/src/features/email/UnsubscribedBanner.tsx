import type { ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n } from '@common/i18n/useI18n'

import { formatAddressName } from './addresses'
import type { EmailDetail } from './queries'
import { isUnsubscribed } from './unsubscribe'

export interface UnsubscribedBannerProps {
  email: Pick<EmailDetail, 'keywords' | 'from'>
}

/**
 * Says the user unsubscribed from the sender of the email (its
 * `$unsubscribe` keyword), as tmail-flutter's `MailUnsubscribedBanner`
 */
export function UnsubscribedBanner({
  email
}: UnsubscribedBannerProps): ReactElement | null {
  const { t } = useI18n()
  if (!isUnsubscribed(email)) return null
  const sender = email.from?.[0]
  return (
    <SecondaryText className="u-mv-1" data-testid="email-unsubscribed-banner">
      {t('unsubscribe.banner', {
        senderName: sender ? formatAddressName(sender) : ''
      })}
    </SecondaryText>
  )
}
