import { Icon, Logout, Setting } from '@linagora/twake-icons'
import { ListItemIcon, ListItemText, MenuItem } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { ProfileMenu } from '@/ds/ProfileMenu/ProfileMenu'
import { ownName } from '@common/features/identities/ownName'
import { useIdentities } from '@common/features/identities/useIdentities'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { SETTINGS_PATH } from '@common/features/settings/sections'
import { isSettingsExitState } from '@common/features/settings/SettingsExitProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { useLogout } from './useLogout'

/**
 * The account of the user at the end of tmail-flutter's bar, without the
 * platform: its initial, opening its display name (the name of the identity
 * of its own address, tmail-flutter#2756), the address, "Manage account"
 * (the settings) and "Sign out"
 */
export function AccountMenu(): ReactElement {
  const { t } = useI18n()
  const { session, view } = useJmapSession()
  // The settings of a mailbox delegated to the user are the owner's
  const hasSettings = view.kind !== 'delegated'
  const { notify } = useNotify()
  const navigate = useNavigate()
  const handleLogout = useLogout()
  const address = session.username
  const identities = useIdentities().data ?? []
  const name = ownName(identities, address)
  // "Back to mail" gives the focus back to the button the settings came from
  const buttonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const isBackFromSettings = isSettingsExitState(location.state)
  useEffect(() => {
    if (isBackFromSettings) buttonRef.current?.focus()
  }, [isBackFromSettings, location.key])

  const handleCopy = (): void => {
    navigator.clipboard
      .writeText(address)
      .then(() => {
        notify({ message: t('email.address.copied'), severity: 'success' })
      })
      .catch((error: unknown) => {
        console.warn('[account] Cannot copy the address', error)
      })
  }

  return (
    <ProfileMenu
      initial={(name ?? address).charAt(0).toUpperCase()}
      name={name}
      address={address}
      labels={{
        open: t('topbar.account', { address }),
        close: t('common.close'),
        copy: t('email.address.copy'),
        menu: t('topbar.account', { address })
      }}
      onCopy={handleCopy}
      buttonRef={buttonRef}
      data-testid="account-menu-button"
    >
      {close => [
        hasSettings ? (
          <MenuItem
            key="settings"
            onClick={() => {
              close()
              void navigate(SETTINGS_PATH)
            }}
            data-testid="settings-button"
          >
            <ListItemIcon>
              <Icon icon={Setting} />
            </ListItemIcon>
            <ListItemText primary={t('settings.manageAccount')} />
          </MenuItem>
        ) : null,
        <MenuItem
          key="logout"
          onClick={() => {
            close()
            handleLogout()
          }}
          data-testid="logout-button"
        >
          <ListItemIcon>
            <Icon icon={Logout} />
          </ListItemIcon>
          <ListItemText primary={t('topbar.logout')} />
        </MenuItem>
      ]}
    </ProfileMenu>
  )
}
