import type { ReactElement } from 'react'

import { NoticeBanner } from '@/ds/NoticeBanner/NoticeBanner'
import { useI18n } from '@common/i18n/useI18n'

export interface RemoteContentBannerProps {
  /** Shows the remote content of this email */
  onShow: () => void
  /** Shows it, now and for every email of this sender; absent without sender */
  onAlwaysShow: (() => void) | null
}

/**
 * Tells that the remote images of the email are hidden (they would tell the
 * sender when and where it is read), and offers to show them. A polite live
 * region: screen readers hear it once the email is open.
 */
export function RemoteContentBanner({
  onShow,
  onAlwaysShow
}: RemoteContentBannerProps): ReactElement {
  const { t } = useI18n()
  return (
    <NoticeBanner
      role="status"
      className="u-mb-1"
      actions={[
        {
          label: t('email.remoteContent.show'),
          onClick: onShow,
          'data-testid': 'remote-content-show-button'
        },
        ...(onAlwaysShow
          ? [
              {
                label: t('email.remoteContent.alwaysShow'),
                onClick: onAlwaysShow,
                'data-testid': 'remote-content-always-show-button'
              }
            ]
          : [])
      ]}
      data-testid="remote-content-banner"
    >
      {t('email.remoteContent.hidden')}
    </NoticeBanner>
  )
}
