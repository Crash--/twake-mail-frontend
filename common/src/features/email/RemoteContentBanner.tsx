import { Alert, Box, Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

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
    <Alert
      severity="info"
      role="status"
      className="u-mb-1"
      data-testid="remote-content-banner"
      action={
        <Box className="u-flex u-flex-wrap">
          <Button
            color="inherit"
            size="small"
            onClick={onShow}
            data-testid="remote-content-show-button"
          >
            {t('email.remoteContent.show')}
          </Button>
          {onAlwaysShow ? (
            <Button
              color="inherit"
              size="small"
              onClick={onAlwaysShow}
              data-testid="remote-content-always-show-button"
            >
              {t('email.remoteContent.alwaysShow')}
            </Button>
          ) : null}
        </Box>
      }
    >
      {t('email.remoteContent.hidden')}
    </Alert>
  )
}
