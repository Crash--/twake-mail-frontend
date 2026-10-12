import { Icon } from '@linagora/twake-icons'
import { Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { WarningCircle } from '@/ds/FlutterIcons/FlutterIcons'
import { useI18n } from '@common/i18n/useI18n'

export interface ImportantMarkProps {
  /** Shows "Important" beside the icon; otherwise said to screen readers only */
  showLabel?: boolean
}

/** Says that the sender marked the email important (`isMarkedImportant`) */
export function ImportantMark({
  showLabel = false
}: ImportantMarkProps): ReactElement {
  const { t } = useI18n()
  const label = t('email.important')
  return (
    <Typography
      component="span"
      variant="body2"
      color="textPrimary"
      className="u-dib u-flex-shrink-0 u-mr-half"
      data-testid="important-flag-icon"
    >
      <Icon icon={WarningCircle} aria-hidden="true" className="u-mr-half" />
      <span className={showLabel ? undefined : 'u-visuallyhidden'}>
        {label}
      </span>
    </Typography>
  )
}
