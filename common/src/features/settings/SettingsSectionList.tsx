import { Icon, Left } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip, Typography } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement } from 'react'
import { Link } from 'react-router'

import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { useI18n } from '@common/i18n/useI18n'

import {
  SETTINGS_EXIT_STATE,
  useSettingsExitPath
} from './SettingsExitProvider'
import { SettingsNav } from './SettingsNav'

/**
 * `/settings` below the desktop size: the menu of the sections, as
 * tmail-flutter's first level; one opens in its place.
 */
export function SettingsSectionList(): ReactElement {
  const { t } = useI18n()
  const exitPath = useSettingsExitPath()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const title = t('settings.title')
  const backLabel = t('settings.backToMail')
  useDocumentTitle(title)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <Box className="u-p-1" data-testid="settings-section-list">
      <Box className="u-flex u-flex-items-center">
        <Tooltip title={backLabel}>
          <IconButton
            component={Link}
            to={exitPath}
            state={SETTINGS_EXIT_STATE}
            aria-label={backLabel}
            data-testid="settings-back-button"
          >
            <Icon icon={Left} />
          </IconButton>
        </Tooltip>
        <Typography
          ref={headingRef}
          variant="h3"
          component="h1"
          tabIndex={-1}
          className="u-ml-half"
        >
          {title}
        </Typography>
      </Box>
      {/* As tmail-flutter's menu on a phone: one row per section. The nav
          of twake-mui lays its items out as a bottom bar there */}
      <SettingsNav />
    </Box>
  )
}
