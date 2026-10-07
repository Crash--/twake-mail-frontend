import { Icon, Logout } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { useLogout } from './useLogout'

/**
 * Signs out from the platform bar while it has no account menu: the
 * platform is out of reach (basic mode, no workplace, exchange refused)
 */
export function LogoutButton(): ReactElement {
  const { t } = useI18n()
  const handleLogout = useLogout()
  const label = t('topbar.logout')

  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        onClick={handleLogout}
        data-testid="logout-button"
      >
        <Icon icon={Logout} />
      </IconButton>
    </Tooltip>
  )
}
