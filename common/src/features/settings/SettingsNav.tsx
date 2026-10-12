import { Box } from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'
import { Link, useMatch } from 'react-router'

import {
  SettingsMenuDivider,
  SettingsMenuItem,
  SettingsMenuList,
  SettingsMenuTitle
} from '@/ds/SettingsMenu/SettingsMenu'
import { HelpOutlined } from '@/ds/FlutterIcons/FlutterIcons'
import { SignOutSettingsIcon } from '@/ds/SettingsIcons/SettingsIcons'
import { useContactSupport } from '@common/features/support/useContactSupport'
import { useI18n } from '@common/i18n/useI18n'

import { settingsSectionPath, type SettingsSection } from './sections'
import { useSettingsSections } from './useSettingsSections'

function SettingsNavItem({
  section
}: {
  section: SettingsSection
}): ReactElement {
  const { t } = useI18n()
  const path = settingsSectionPath(section.id)
  const isSelected = useMatch(`${path}/*`) !== null

  return (
    <SettingsMenuItem
      icon={section.icon}
      label={t(section.title)}
      isSelected={isSelected}
      component={Link}
      to={path}
      data-testid={`settings-menu-${section.id}`}
    />
  )
}

/**
 * The sections of the settings, as tmail-flutter's menu: "Manage account",
 * the sections, then "Sign out" when given (the sidebar of a desktop; on
 * smaller screens the bars at the top sign out)
 */
export function SettingsNav({
  onSignOut = null
}: {
  onSignOut?: (() => void) | null
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const sections = useSettingsSections()
  const support = useContactSupport()

  return (
    <Box component="nav" aria-labelledby={titleId} data-testid="settings-nav">
      <SettingsMenuTitle id={titleId}>
        {t('settings.manageAccount')}
      </SettingsMenuTitle>
      <SettingsMenuList>
        {sections.map(section => (
          <SettingsNavItem key={section.id} section={section} />
        ))}
      </SettingsMenuList>
      {onSignOut === null ? null : (
        <>
          <SettingsMenuDivider />
          <SettingsMenuList>
            {/* As tmail-flutter: when the server tells where to ask; the
                settings have no composer, an address opens the mail app */}
            {support === null ? null : (
              <SettingsMenuItem
                icon={HelpOutlined}
                label={t('settings.contactSupport')}
                href={
                  support.kind === 'address'
                    ? `mailto:${support.address}`
                    : support.href
                }
                isExternal={support.kind === 'link'}
                data-testid="settings-contact-support"
              />
            )}
            <SettingsMenuItem
              icon={SignOutSettingsIcon}
              label={t('topbar.logout')}
              onClick={onSignOut}
              data-testid="settings-sign-out-button"
            />
          </SettingsMenuList>
        </>
      )}
    </Box>
  )
}
