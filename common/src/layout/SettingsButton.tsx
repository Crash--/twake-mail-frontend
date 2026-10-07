import { Icon, Setting } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { SETTINGS_PATH } from '@common/features/settings/sections'
import { useI18n } from '@common/i18n/useI18n'

/**
 * Opens the settings: in the search row of a desktop, and in the top bar
 * under the platform bar, whose account menu knows nothing of them
 */
export function SettingsButton(): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const label = t('settings.title')

  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        onClick={() => {
          void navigate(SETTINGS_PATH)
        }}
        data-testid="settings-button"
      >
        <Icon icon={Setting} />
      </IconButton>
    </Tooltip>
  )
}
