import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Link } from 'react-router'

import { ChipBackButton } from '@/ds/ChipBackButton/ChipBackButton'
import { ResponsiveSidebar } from '@/ds/ResponsiveSidebar/ResponsiveSidebar'
import { useI18n } from '@common/i18n/useI18n'

import {
  SETTINGS_EXIT_STATE,
  useSettingsExitPath
} from './SettingsExitProvider'
import { SettingsNav } from './SettingsNav'

/** Width of the settings menu of tmail-flutter (`defaultSizeMenu`) */
const SETTINGS_SIDEBAR_WIDTH = 256

export interface SettingsSidebarProps {
  /** "Sign out" at the end of the menu */
  onSignOut: () => void
}

/**
 * The column of the settings on a desktop, as tmail-flutter's: "Back" to
 * the mail, then "Manage account" and its sections, and "Sign out". Smaller
 * screens list the sections in the page.
 */
export function SettingsSidebar({
  onSignOut
}: SettingsSidebarProps): ReactElement {
  const { t } = useI18n()
  const exitPath = useSettingsExitPath()

  return (
    <ResponsiveSidebar
      open={false}
      onClose={() => undefined}
      label={t('settings.title')}
      closeLabel={t('common.close')}
      width={SETTINGS_SIDEBAR_WIDTH}
      data-testid="settings-sidebar"
    >
      <Box className="u-ml-1 u-mt-1-half">
        <ChipBackButton
          component={Link}
          to={exitPath}
          state={SETTINGS_EXIT_STATE}
          label={t('settings.backToMail')}
          data-testid="settings-back-button"
        >
          {t('common.back')}
        </ChipBackButton>
      </Box>
      <Box className="u-flex-auto u-ov-auto u-mt-half u-ph-half">
        <SettingsNav onSignOut={onSignOut} />
      </Box>
    </ResponsiveSidebar>
  )
}
