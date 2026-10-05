import { Setting } from '@linagora/twake-icons'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { AccountMenu } from '@/ds/AccountMenu/AccountMenu'
import {
  useAuthService,
  useAuthState
} from '@common/features/auth/AuthProvider'
import { SETTINGS_PATH } from '@common/features/settings/sections'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

const TEST_IDS = {
  button: 'user-avatar',
  menu: 'account-menu',
  identity: 'user-menu-identity',
  logout: 'logout-button'
}

/**
 * Avatar of the signed-in user, opening the account menu: the settings
 * ("Manage account" in tmail-flutter) and sign out.
 */
export function UserMenu(): ReactElement {
  const { t } = useI18n()
  const service = useAuthService()
  const state = useAuthState()
  const { session } = useJmapSession()
  const navigate = useNavigate()
  const user =
    state.status === 'authenticated' ? state.user : { email: null, name: null }
  // Basic mode only knows what the user typed, and the SSO may not tell the
  // email: the JMAP session tells who the server authenticated
  const email =
    service.mode === 'basic'
      ? session.username
      : (user.email ?? session.username)

  const handleLogout = (): void => {
    service.logout().catch((error: unknown) => {
      console.error('[auth] Logout failed', error)
    })
  }

  return (
    <AccountMenu
      name={user.name}
      email={email}
      label={t('topbar.account')}
      logoutLabel={t('topbar.logout')}
      onLogout={handleLogout}
      items={[
        {
          label: t('settings.title'),
          icon: Setting,
          onClick: () => {
            void navigate(SETTINGS_PATH)
          },
          'data-testid': 'settings-menu-item'
        }
      ]}
      testIds={TEST_IDS}
    />
  )
}
