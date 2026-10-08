import { Box } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'

import {
  SettingsDescription,
  SettingsPane,
  SettingsTitle
} from '@/ds/SettingsHeading/SettingsHeading'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { useI18n } from '@common/i18n/useI18n'

import type { SettingsSection } from './sections'

export interface SettingsSectionLayoutProps {
  section: SettingsSection
  /** Buttons beside the title, e.g. "Create new identity" */
  actions?: ReactNode
  children: ReactNode
}

/**
 * A settings section: its title (the heading of the page, focused when the
 * section opens), what it is for, and its content. Below the desktop size
 * the bar at the top has its name and the arrow back to the list of
 * sections.
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
  useDocumentTitle(`${title} - ${t('settings.title')}`)

  useEffect(() => {
    const heading = headingRef.current
    heading?.focus()
    // The page starts at its top, whatever the scroll of the list of
    // sections it was opened from (phones): the heading is visually hidden
    // there, so its scrolling ancestor goes back to the top itself
    let area = heading?.parentElement ?? null
    while (
      area !== null &&
      !['auto', 'scroll'].includes(getComputedStyle(area).overflowY)
    ) {
      area = area.parentElement
    }
    area?.scrollTo({ top: 0 })
  }, [section.id])

  return (
    <SettingsPane
      labelledBy={`settings-${section.id}-title`}
      data-testid={`settings-section-${section.id}`}
    >
      {/* As tmail-flutter: the title and what the section is for on the
          left, its buttons on the right, at the top; below the desktop
          size the bar at the top has the title and the arrow back, what
          the section is for and its buttons are in the middle */}
      {isDesktop ? (
        <Box className="u-flex u-flex-items-start">
          <Box className="u-flex-auto u-mr-1">
            <SettingsTitle ref={headingRef} id={`settings-${section.id}-title`}>
              {title}
            </SettingsTitle>
            {section.description === null ? null : (
              <SettingsDescription>
                {t(section.description)}
              </SettingsDescription>
            )}
          </Box>
          {actions}
        </Box>
      ) : (
        <>
          <SettingsTitle
            ref={headingRef}
            id={`settings-${section.id}-title`}
            className="u-visuallyhidden"
          >
            {title}
          </SettingsTitle>
          {section.description === null ? null : (
            <SettingsDescription isCentered>
              {t(section.description)}
            </SettingsDescription>
          )}
          {actions === undefined ? null : (
            <Box className="u-flex u-flex-justify-center u-mt-1">{actions}</Box>
          )}
        </>
      )}
      <Box className={isDesktop ? 'u-mt-1-half' : 'u-mt-1'}>{children}</Box>
    </SettingsPane>
  )
}
