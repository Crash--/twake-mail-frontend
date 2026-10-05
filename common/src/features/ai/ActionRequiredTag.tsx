import type { ReactElement } from 'react'

import { ColorTag } from '@/ds/ColorTag/ColorTag'
import { useI18n } from '@common/i18n/useI18n'

/** The purple of tmail-flutter's "Action required" tag (`aiActionTag`) */
export const ACTION_REQUIRED_TAG_COLOR = '#7E57E3'

export interface ActionRequiredTagProps {
  /** Shows a × taking the keyword off the email (the opened email only) */
  onRemove?: () => void
  /** Cut the name after this many characters (a list row) */
  maxLength?: number
}

/** The tag of an email the AI found needs an action */
export function ActionRequiredTag({
  onRemove,
  maxLength
}: ActionRequiredTagProps): ReactElement {
  const { t } = useI18n()
  return (
    <ColorTag
      label={t('email.actionRequired')}
      color={ACTION_REQUIRED_TAG_COLOR}
      removeLabel={onRemove ? t('email.removeActionRequired') : undefined}
      onRemove={onRemove}
      maxLength={maxLength}
      data-testid="action-required-tag"
    />
  )
}
