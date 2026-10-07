import { Icon, Left } from '@linagora/twake-icons'
import { Box, Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Link } from 'react-router'

import { ResponsiveSidebar } from '@/ds/ResponsiveSidebar/ResponsiveSidebar'
import { useI18n } from '@common/i18n/useI18n'

import {
  SETTINGS_EXIT_STATE,
  useSettingsExitPath
} from './SettingsExitProvider'
import { SettingsNav } from './SettingsNav'

/**
 * The column of the settings on a desktop, as tmail-flutter's: back to the
 * mail, then the sections. Smaller screens list the sections in the page.
 */
export function SettingsSidebar(): ReactElement {
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
      <Box className="u-mh-1 u-mt-1">
        <Button
          component={Link}
          to={exitPath}
          state={SETTINGS_EXIT_STATE}
          variant="text"
          color="inherit"
          startIcon={<Icon icon={Left} />}
          data-testid="settings-back-button"
        >
          {t('settings.backToMail')}
        </Button>
      </Box>
      <Box className="u-flex-auto u-ov-auto u-mt-1">
        <SettingsNav />
      </Box>
    </ResponsiveSidebar>
  )
}
