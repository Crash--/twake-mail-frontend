import { Icon, Left } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip, Typography } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import { Link } from 'react-router'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
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
    <Box
      component="section"
      aria-labelledby={`settings-${section.id}-title`}
      className="u-p-1-half"
      data-testid={`settings-section-${section.id}`}
    >
      <Box className="u-flex u-flex-items-center u-flex-wrap">
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
        <Typography
          ref={headingRef}
          id={`settings-${section.id}-title`}
          variant="h3"
          component="h1"
          tabIndex={-1}
          className="u-flex-auto"
        >
          {title}
        </Typography>
        {actions}
      </Box>
      {section.description === null ? null : (
        <SecondaryText variant="body2" component="p" className="u-mt-half">
          {t(section.description)}
        </SecondaryText>
      )}
      <Box className="u-mt-1">{children}</Box>
    </Box>
  )
}
