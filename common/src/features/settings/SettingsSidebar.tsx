import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Link } from 'react-router'

import { ChipBackButton } from '@/ds/ChipBackButton/ChipBackButton'
import { ResponsiveSidebar } from '@/ds/ResponsiveSidebar/ResponsiveSidebar'
import { useI18n } from '@common/i18n/useI18n'
import { MailSidebarFooter } from '@common/layout/MailSidebarFooter'

import {
  SETTINGS_EXIT_STATE,
  useSettingsExitPath
} from './SettingsExitProvider'
import { SettingsNav } from './SettingsNav'

export interface SettingsSidebarProps {
  /** "Sign out" at the end of the menu */
  onSignOut: () => void
}

/**
 * The column of the settings on a desktop, as the Figma's: "Back" to the
 * mail, "Manage account" and its sections, "More" (support, sign out), and
 * the storage and the version at the foot, as the mail's sidebar. Smaller
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
      data-testid="settings-sidebar"
    >
      <Box className="u-flex-auto u-ov-auto u-ph-1 u-pt-1">
        <ChipBackButton
          component={Link}
          to={exitPath}
          state={SETTINGS_EXIT_STATE}
          label={t('settings.backToMail')}
          data-testid="settings-back-button"
        >
          {t('common.back')}
        </ChipBackButton>
        <Box className="u-mt-1-half u-pb-1">
          <SettingsNav onSignOut={onSignOut} />
        </Box>
      </Box>
      <MailSidebarFooter />
    </ResponsiveSidebar>
  )
}
