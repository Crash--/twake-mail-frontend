import type { ReactElement } from 'react'

import { ColorTag } from '@/ds/ColorTag/ColorTag'
import { useI18n } from '@common/i18n/useI18n'

// twake-mui has no role for the AI (tmail-flutter's was purple): `info`,
// its dark shade, as white on `info.main` stays under 4.5:1 (2.33:1). The
// dark shade is light in the dark scheme: the text takes `contrastText`
export const ACTION_REQUIRED_TAG_COLOR = 'var(--twake-palette-info-dark)'
const ACTION_REQUIRED_TEXT_COLOR = 'var(--twake-palette-info-contrastText)'

export interface ActionRequiredTagProps {
  /** Shows a × taking the keyword off the email (the opened email only) */
  onRemove?: () => void
  /** Cut the name after this many characters (a list row) */
  maxLength?: number
  /** `small` in a list row */
  size?: 'small' | 'medium'
}

/** The tag of an email the AI found needs an action */
export function ActionRequiredTag({
  onRemove,
  maxLength,
  size
}: ActionRequiredTagProps): ReactElement {
  const { t } = useI18n()
  return (
    <ColorTag
      label={t('email.actionRequired')}
      color={ACTION_REQUIRED_TAG_COLOR}
      textColor={ACTION_REQUIRED_TEXT_COLOR}
      removeLabel={onRemove ? t('email.removeActionRequired') : undefined}
      onRemove={onRemove}
      maxLength={maxLength}
      size={size}
      data-testid="action-required-tag"
    />
  )
}
