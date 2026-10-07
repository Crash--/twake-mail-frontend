import { Box, Nav, NavIcon, Typography } from '@linagora/twake-mui'
import { NavItem } from '@/ds/NavItem/NavItem'
import { NavLink } from '@/ds/NavLink/NavLink'
import { NavText } from '@/ds/NavText/NavText'
import { useId, type ReactElement } from 'react'
import { Link, useMatch } from 'react-router'

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
    <NavItem>
      <NavLink
        component={Link}
        to={path}
        selected={isSelected}
        aria-current={isSelected ? 'page' : undefined}
        data-testid={`settings-menu-${section.id}`}
      >
        <NavIcon icon={section.icon} />
        <NavText className="u-ellipsis">{t(section.title)}</NavText>
      </NavLink>
    </NavItem>
  )
}

/** The sections of the settings, in the sidebar of a desktop */
export function SettingsNav(): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const sections = useSettingsSections()

  return (
    <Box component="nav" aria-labelledby={titleId} data-testid="settings-nav">
      <Typography
        id={titleId}
        variant="subtitle2"
        component="p"
        color="textPrimary"
        className="u-mh-1 u-mv-half"
      >
        {t('settings.title')}
      </Typography>
      <Nav>
        {sections.map(section => (
          <SettingsNavItem key={section.id} section={section} />
        ))}
      </Nav>
    </Box>
  )
}
