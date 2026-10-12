import { Box, Typography } from '@linagora/twake-mui'
import { useEffect, useId, useRef, type ReactElement } from 'react'
import { Link } from 'react-router'

import { HelpOutlined } from '@/ds/FlutterIcons/FlutterIcons'
import { GradientAvatar } from '@/ds/GradientAvatar/GradientAvatar'
import { SignOutSettingsIcon } from '@/ds/SettingsIcons/SettingsIcons'
import {
  SettingsAccount,
  SettingsTile,
  SettingsTileList
} from '@/ds/SettingsTiles/SettingsTiles'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useContactSupport } from '@common/features/support/useContactSupport'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { useLogout } from '@common/layout/useLogout'

import { settingsSectionPath } from './sections'
import { useSettingsSections } from './useSettingsSections'

/**
 * `/settings` below the desktop size: the menu of the sections, as
 * tmail-flutter's first level (who is signed in, then one entry per
 * section with its explanation); one opens in its place. The bar at the top
 * holds the title and the cross going back to the mail.
 */
export function SettingsSectionList(): ReactElement {
  const { t } = useI18n()
  const { session } = useJmapSession()
  const sections = useSettingsSections()
  const handleLogout = useLogout()
  const support = useContactSupport()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const headingId = useId()
  const title = t('settings.title')
  // As tmail-flutter's account: two letters, their own gradient
  const initials = session.username.slice(0, 2).toUpperCase()
  useDocumentTitle(title)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <Box
      component="nav"
      aria-labelledby={headingId}
      data-testid="settings-section-list"
    >
      <Typography
        ref={headingRef}
        id={headingId}
        variant="h3"
        component="h1"
        tabIndex={-1}
        className="u-visuallyhidden"
      >
        {title}
      </Typography>
      <SettingsAccount
        avatar={
          <GradientAvatar
            text={initials}
            colorKey={initials}
            size={51}
            fontSize={25}
          />
        }
      >
        {session.username}
      </SettingsAccount>
      <SettingsTileList>
        {sections.map(section => (
          <SettingsTile
            key={section.id}
            icon={section.icon}
            title={t(section.title)}
            // As tmail-flutter: "Preferences" has no explanation here
            explanation={
              section.description === null || section.id === 'preferences'
                ? null
                : t(section.description)
            }
            component={Link}
            to={settingsSectionPath(section.id)}
            data-testid={`settings-menu-${section.id}`}
          />
        ))}
        {/* As tmail-flutter: the support, when the server names one, and
            signing out end the list */}
        {support === null ? null : (
          <SettingsTile
            icon={HelpOutlined}
            title={t('settings.contactSupport')}
            explanation={null}
            href={
              support.kind === 'address'
                ? `mailto:${support.address}`
                : support.href
            }
            isExternal={support.kind === 'link'}
            data-testid="settings-contact-support"
          />
        )}
        <SettingsTile
          icon={SignOutSettingsIcon}
          title={t('topbar.logout')}
          explanation={null}
          onClick={handleLogout}
          data-testid="settings-sign-out-button"
        />
      </SettingsTileList>
    </Box>
  )
}
