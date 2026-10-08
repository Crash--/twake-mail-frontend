import { Icon, Left } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import { Link } from 'react-router'

import {
  SettingsDescription,
  SettingsPane,
  SettingsTitle
} from '@/ds/SettingsHeading/SettingsHeading'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { useI18n } from '@common/i18n/useI18n'

import { SETTINGS_PATH, type SettingsSection } from './sections'

export interface SettingsSectionLayoutProps {
  section: SettingsSection
  /** Buttons beside the title, e.g. "Create new identity" */
  actions?: ReactNode
  children: ReactNode
}

/**
 * A settings section: its title (the heading of the page, focused when the
 * section opens), what it is for, and its content. Below the desktop size a
 * back button returns to the list of sections.
 */
export function SettingsSectionLayout({
  section,
  actions,
  children
}: SettingsSectionLayoutProps): ReactElement {
  const { t } = useI18n()
  const isDesktop = useScreenSize() === 'desktop'
  const headingRef = useRef<HTMLHeadingElement>(null)
  const title = t(section.title)
  const backLabel = t('common.back')
  useDocumentTitle(`${title} - ${t('settings.title')}`)

  useEffect(() => {
    headingRef.current?.focus()
  }, [section.id])

  return (
    <SettingsPane
      labelledBy={`settings-${section.id}-title`}
      data-testid={`settings-section-${section.id}`}
    >
      {/* As tmail-flutter: the title and what the section is for on the
          left, its buttons on the right, at the top */}
      <Box className="u-flex u-flex-items-start">
        {isDesktop ? null : (
          <Tooltip title={backLabel}>
            <IconButton
              component={Link}
              to={SETTINGS_PATH}
              aria-label={backLabel}
              className="u-mr-half"
              data-testid="settings-section-back-button"
            >
              <Icon icon={Left} />
            </IconButton>
          </Tooltip>
        )}
        <Box className="u-flex-auto u-mr-1">
          <SettingsTitle ref={headingRef} id={`settings-${section.id}-title`}>
            {title}
          </SettingsTitle>
          {section.description === null ? null : (
            <SettingsDescription>{t(section.description)}</SettingsDescription>
          )}
        </Box>
        {actions}
      </Box>
      <Box className="u-mt-1-half">{children}</Box>
    </SettingsPane>
  )
}
