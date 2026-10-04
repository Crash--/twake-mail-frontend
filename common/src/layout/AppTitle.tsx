import { Icon, Mail, MailText, TwakeText } from '@linagora/twake-icons'
import { Stack } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

/**
 * The Twake Mail logotype. Rebuilt from twake-icons because the `AppTitle`
 * of twake-mui is not exported (see docs/twake-mui-gaps.md). Injectable, so
 * that a deployment can brand it: `@injected/layout/AppTitle`.
 */
export function AppTitle(): ReactElement {
  const { t } = useI18n()

  return (
    <Stack
      direction="row"
      spacing={1}
      className="u-flex-items-center"
      role="img"
      aria-label={t('app.name')}
      data-testid="app-title"
    >
      <Icon icon={Mail} size={32} preserveColor aria-hidden="true" />
      <Icon icon={TwakeText} width={58} height={22} aria-hidden="true" />
      <Icon icon={MailText} width={54} height={22} aria-hidden="true" />
    </Stack>
  )
}
