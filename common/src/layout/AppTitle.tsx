import type { ReactElement } from 'react'

import { AppTitle as Logotype } from '@/ds/AppTitle/AppTitle'
import { useI18n } from '@common/i18n/useI18n'

/**
 * Served by the app at the path of tmail-flutter's image, so that a
 * deployment changes the logotype by mounting another SVG over the file
 * (docs/deployment.md). The dark one has no counterpart in tmail-flutter.
 */
const LOGOTYPE_PATH = '/assets/assets/images/ic_logo_with_text.svg'
const DARK_LOGOTYPE_PATH = '/assets/assets/images/ic_logo_with_text_dark.svg'

/**
 * The Twake Mail logotype of the top bar and the login card. Injectable, so
 * that a deployment can brand it: `@injected/layout/AppTitle`.
 */
export function AppTitle(): ReactElement {
  const { t } = useI18n()

  return (
    <Logotype
      label={t('app.name')}
      src={LOGOTYPE_PATH}
      darkSrc={DARK_LOGOTYPE_PATH}
      data-testid="app-title"
    />
  )
}
