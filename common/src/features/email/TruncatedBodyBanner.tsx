import { Alert, Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

export interface TruncatedBodyBannerProps {
  /** Downloads the whole message (EML), absent when it has no blob */
  onDownload: (() => void) | null
}

/**
 * Says that the server cut the body of the message (`isTruncated`): what is
 * shown is not all of it. The whole message is in its EML. A polite live
 * region: screen readers hear it once the email is open.
 */
export function TruncatedBodyBanner({
  onDownload
}: TruncatedBodyBannerProps): ReactElement {
  const { t } = useI18n()
  return (
    <Alert
      severity="warning"
      role="status"
      className="u-mb-1"
      data-testid="email-body-truncated"
      action={
        onDownload ? (
          <Button
            color="inherit"
            size="small"
            onClick={onDownload}
            data-testid="email-body-download-eml-button"
          >
            {t('emailActions.menu.downloadAsEml')}
          </Button>
        ) : null
      }
    >
      {t('email.bodyTruncated')}
    </Alert>
  )
}
