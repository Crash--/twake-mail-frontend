import { Icon, Left } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Nav,
  NavItem,
  NavLink,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement } from 'react'
import { Link } from 'react-router'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useDocumentTitle } from '@common/app/useDocumentTitle'
import { useI18n } from '@common/i18n/useI18n'

import { settingsSectionPath } from './sections'
import { useSettingsExitPath } from './SettingsExitProvider'
import { useSettingsSections } from './useSettingsSections'

/**
 * `/settings` below the desktop size: the sections with what each is for,
 * as tmail-flutter's first level; one opens in its place.
 */
export function SettingsSectionList(): ReactElement {
  const { t } = useI18n()
  const sections = useSettingsSections()
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
      <Box component="nav" aria-label={title}>
        <Nav>
          {sections.map(section => (
            <NavItem key={section.id}>
              <NavLink
                component={Link}
                to={settingsSectionPath(section.id)}
                data-testid={`settings-menu-${section.id}`}
              >
                <ListItemIcon>
                  <Icon icon={section.icon} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography component="span" color="textPrimary">
                      {t(section.title)}
                    </Typography>
                  }
                  secondary={
                    // The secondary text of the theme lacks contrast
                    // (docs/twake-mui-gaps.md)
                    section.description === null ? null : (
                      <SecondaryText variant="body2">
                        {t(section.description)}
                      </SecondaryText>
                    )
                  }
                />
              </NavLink>
            </NavItem>
          ))}
        </Nav>
      </Box>
    </Box>
  )
}
