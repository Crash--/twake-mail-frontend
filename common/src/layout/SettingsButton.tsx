import { Icon, Setting } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { SETTINGS_PATH } from '@common/features/settings/sections'
import { isSettingsExitState } from '@common/features/settings/SettingsExitProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

/**
 * Opens the settings: in the search row of a desktop, and in the top bar
 * under the platform bar, whose account menu knows nothing of them.
 * "Back to mail" gives it the focus back. None in a mailbox delegated to
 * the user: its settings are the owner's.
 */
export function SettingsButton(): ReactElement | null {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const label = t('settings.title')
  const isBackFromSettings = isSettingsExitState(location.state)
  const isDelegated = useJmapSession().view.kind === 'delegated'

  useEffect(() => {
    if (isBackFromSettings) buttonRef.current?.focus()
  }, [isBackFromSettings, location.key])

  if (isDelegated) return null

  return (
    <Tooltip title={label}>
      <IconButton
        ref={buttonRef}
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
