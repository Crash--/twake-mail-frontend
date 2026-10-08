import { Box } from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'
import { Link, useMatch } from 'react-router'

import {
  SettingsMenuDivider,
  SettingsMenuItem,
  SettingsMenuList,
  SettingsMenuTitle
} from '@/ds/SettingsMenu/SettingsMenu'
import { SignOutSettingsIcon } from '@/ds/SettingsIcons/SettingsIcons'
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
 * The sections of the settings, in the sidebar of a desktop, as
 * tmail-flutter's menu: "Manage account", the sections, then "Sign out"
 */
export function SettingsNav({
  onSignOut
}: {
  onSignOut: () => void
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const sections = useSettingsSections()

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
      <SettingsMenuDivider />
      <SettingsMenuList>
        <SettingsMenuItem
          icon={SignOutSettingsIcon}
          label={t('topbar.logout')}
          onClick={onSignOut}
          data-testid="settings-sign-out-button"
        />
      </SettingsMenuList>
    </Box>
  )
}
