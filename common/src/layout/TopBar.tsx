import { Typography } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement } from 'react'
import { useLocation, useMatch } from 'react-router'

import {
  AppTopBar,
  type AppTopBarSearchActions
} from '@/ds/AppTopBar/AppTopBar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useCurrentMailboxName } from '@common/features/mailbox/useCurrentMailboxName'
import { LABEL_PATH } from '@common/features/labels/labelPaths'
import { useLabels } from '@common/features/labels/queries'
import { SETTINGS_PATH } from '@common/features/settings/sections'
import { isSettingsExitState } from '@common/features/settings/SettingsExitProvider'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'
import { ListFilterSlot } from '@common/features/thread/ListFilterProvider'
import { usePlatformStatus } from '@common/features/platform/PlatformProvider'
import { useI18n } from '@common/i18n/useI18n'

import { HelpButton } from './HelpButton'
import { MailSearchBar } from './MailSearchBar'
import { SettingsButton } from './SettingsButton'

export interface TopBarProps {
  /** Opens the folder drawer */
  onOpenFolders: () => void
}

/**
 * The bar of the mail below the desktop size, as tmail-flutter's: a button
 * opening the folders, the current folder, the filter of the list (and the
 * help and the settings under the bar of Twake Workplace; without it the
 * drawer holds them), and the search under it (not in the settings)
 */
export function TopBar({ onOpenFolders }: TopBarProps): ReactElement {
  const { t } = useI18n()
  const screenSize = useScreenSize()
  const isDesktop = screenSize === 'desktop'
  const isPlatformActive = usePlatformStatus() !== 'public'
  const mailboxName = useCurrentMailboxName()
  const isSearch = useMatch('/search/*') !== null
  const isSettings = useMatch(`${SETTINGS_PATH}/*`) !== null
  const labelId = useMatch(`${LABEL_PATH}/:labelId/*`)?.params.labelId
  const labelName =
    useLabels().data?.list.find(label => label.id === labelId)?.displayName ??
    null
  const folderName = isSettings
    ? t('settings.title')
    : isSearch
      ? t('search.title')
      : (labelName ?? mailboxName)
  const searchActions = useRef<AppTopBarSearchActions>(null)
  // Without the platform the settings open from the drawer, which "Back to
  // mail" finds closed: the button that opened it takes the focus back
  const menuRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const isBackFromSettings = isSettingsExitState(location.state)
  useEffect(() => {
    if (!isBackFromSettings || isPlatformActive) return undefined
    // After the page under it took the focus on its way in
    const timer = window.setTimeout(() => {
      menuRef.current?.focus()
    }, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [isBackFromSettings, isPlatformActive, location.key])
  // On desktops the search is in the page, which handles the shortcut
  useShortcuts(
    { '/': () => searchActions.current?.focusSearch() },
    () => !isDesktop
  )
  const folderTitle =
    folderName === null ? null : (
      <Typography
        variant="h4"
        component="span"
        noWrap
        data-testid="top-bar-folder-name"
      >
        {folderName}
      </Typography>
    )

  return (
    <AppTopBar
      title={folderTitle}
      search={isSettings ? null : <MailSearchBar isCompact />}
      actions={
        <>
          <ListFilterSlot />
          {/* Without the platform they are in the drawer, as tmail-flutter */}
          {isPlatformActive ? (
            <>
              <HelpButton />
              <SettingsButton />
            </>
          ) : null}
        </>
      }
      menu={{
        label: t('topbar.showFolders'),
        onOpen: onOpenFolders,
        'data-testid': 'mobile-mailbox-menu-button'
      }}
      menuButtonRef={menuRef}
      searchActions={searchActions}
      data-testid="top-bar"
    />
  )
}
