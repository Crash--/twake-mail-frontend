import { Copy, HelpOutlined, Icon, Logout } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip, Typography } from '@linagora/twake-mui'
import { useEffect, useId, useRef, type ReactElement } from 'react'
import { Link } from 'react-router'

import { GradientAvatar } from '@/ds/GradientAvatar/GradientAvatar'
import { initialsOf } from '@/ds/RecipientField/initials'
import {
  SettingsAccount,
  SettingsBackButton,
  SettingsTile,
  SettingsTileList,
  SettingsTilesPage
} from '@/ds/SettingsTiles/SettingsTiles'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import { ownName } from '@common/features/identities/ownName'
import { useIdentities } from '@common/features/identities/useIdentities'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useContactSupport } from '@common/features/support/useContactSupport'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { useLogout } from '@common/layout/useLogout'

import { settingsSectionPath } from './sections'
import {
  SETTINGS_EXIT_STATE,
  useSettingsExitPath
} from './SettingsExitProvider'
import { useSettingsSections } from './useSettingsSections'

/**
 * `/settings` below the desktop size: the menu of the sections. At the top,
 * the way back to the mail and who is signed in (name, address and its copy
 * button); then one entry per section with its explanation, and the
 * support and signing out in a group of their own. One opens in its place.
 */
export function SettingsSectionList(): ReactElement {
  const { t } = useI18n()
  const { session } = useJmapSession()
  const { notify } = useNotify()
  const sections = useSettingsSections()
  const handleLogout = useLogout()
  const support = useContactSupport()
  const settingsExitPath = useSettingsExitPath()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const headingId = useId()
  const title = t('settings.title')
  const address = session.username
  const identities = useIdentities().data ?? []
  const name = ownName(identities, address) ?? address.split('@')[0] ?? address
  const initials = initialsOf(name)
  const copyLabel = t('email.address.copy')
  const backLabel = t('settings.backToMail')
  // Tablets keep the bar of the mail and its cross
  const isPhone = useScreenSize() === 'mobile'
  useDocumentTitle(title)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const handleCopy = (): void => {
    navigator.clipboard
      .writeText(address)
      .then(() => {
        notify({ message: t('email.address.copied'), severity: 'success' })
      })
      .catch((error: unknown) => {
        console.warn('[settings] Cannot copy the address', error)
      })
  }

  return (
    <Box
      component="nav"
      aria-labelledby={headingId}
      className="u-h-100"
      data-testid="settings-section-list"
    >
      <SettingsTilesPage>
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
          back={
            isPhone ? (
              <SettingsBackButton
                label={backLabel}
                component={Link}
                to={settingsExitPath}
                state={SETTINGS_EXIT_STATE}
                data-testid="settings-back-button"
              />
            ) : undefined
          }
          avatar={
            <GradientAvatar text={initials} colorKey={address} size={48} />
          }
          name={name}
          address={address}
          addressAction={
            <Tooltip title={copyLabel}>
              <IconButton
                size="small"
                aria-label={copyLabel}
                onClick={handleCopy}
                data-testid="settings-copy-address-button"
              >
                <Icon icon={Copy} size={16} />
              </IconButton>
            </Tooltip>
          }
        />
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
        </SettingsTileList>
        <SettingsTileList>
          {/* As tmail-flutter: the support, when the server names one */}
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
            icon={Logout}
            title={t('topbar.logout')}
            explanation={null}
            onClick={handleLogout}
            data-testid="settings-sign-out-button"
          />
        </SettingsTileList>
      </SettingsTilesPage>
    </Box>
  )
}
