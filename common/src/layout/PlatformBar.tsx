import { SdkProvider, TwakeBar } from '@linagora/twake-bar'
import type { Sdk } from '@linagora/twake-sdk'
import type { ReactElement, ReactNode } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { useLogout } from './useLogout'

// Served by the app, next to index.html
const APP_ICON_PATH = '/assets/images/svg/app-mail.svg'
const APP_TEXT_ICON_PATH = '/assets/images/svg/mail-text.svg'

export interface PlatformBarProps {
  sdk: Sdk
  /** Buttons of the app, before the help, apps and account menus */
  actions?: ReactNode
  /**
   * Replaces the home of the platform and the title: the logotype alone,
   * as tmail-flutter
   */
  left?: ReactNode
  /** Between the title and the menus: the search on a desktop */
  search?: ReactNode
}

/**
 * The top bar of Twake Workplace (`@linagora/twake-bar`): the home of the
 * platform, the Twake Mail logotype, the help, the other apps and the
 * account, read from the platform of the user. Its log out ends the session
 * of the app, which ends the one of the SSO.
 */
export function PlatformBar({
  sdk,
  actions,
  left,
  search
}: PlatformBarProps): ReactElement {
  const { t } = useI18n()
  const handleLogout = useLogout()

  return (
    <SdkProvider client={sdk}>
      <TwakeBar
        app={{
          slug: 'mail',
          name: t('app.name'),
          icon: new URL(APP_ICON_PATH, window.location.origin).href,
          textIcon: new URL(APP_TEXT_ICON_PATH, window.location.origin).href
        }}
        onLogOut={handleLogout}
        slots={{ left, search, right: actions }}
      />
    </SdkProvider>
  )
}
