import { Icon, TwakeWorkplace } from '@linagora/twake-icons'
import { Divider, Typography } from '@linagora/twake-mui'
import { useRef, type ReactElement } from 'react'
import { useMatch } from 'react-router'

import {
  AppTopBar,
  type AppTopBarSearchActions
} from '@/ds/AppTopBar/AppTopBar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import type { AppListEntry } from '@common/config/config'
import { useCurrentMailboxName } from '@common/features/mailbox/useCurrentMailboxName'
import { LABEL_PATH } from '@common/features/labels/labelPaths'
import { useLabels } from '@common/features/labels/queries'
import { SETTINGS_PATH } from '@common/features/settings/sections'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'
import { useIsEmbedded } from '@common/features/embedding/embedding'
import { ListFilterSlot } from '@common/features/thread/ListFilterProvider'
import { useI18n } from '@common/i18n/useI18n'
import { AppTitle } from '@injected/layout/AppTitle'

import { AppGridMenu } from './AppGridMenu'
import { HelpButton } from './HelpButton'
import { MailSearchBar } from './MailSearchBar'
import { SettingsButton } from './SettingsButton'
import { UserMenu } from './UserMenu'

const SEARCH_TEST_IDS = {
  openSearch: 'search-open-button',
  closeSearch: 'search-back-button'
}

export interface TopBarProps {
  apps: readonly AppListEntry[]
  /** Opens the folder drawer, below the desktop size */
  onOpenFolders: () => void
  /**
   * Under the platform bar, which holds the logotype, the app grid and the
   * account: this bar keeps the folder, the search and a settings button
   */
  isUnderPlatformBar?: boolean
}

/**
 * Logotype, search, app grid and account menu. Below the desktop size a
 * button opens the folders; phones show the current folder instead of the
 * logotype (which moves to the drawer, with the app grid) and fold the
 * search behind a button. Inside Twake Workplace (`WORKPLACE_EMBEDDING`),
 * the container holds the logotype and the app grid, and the account
 * button is a gear, as in Twake Calendar. Under the platform bar, the folder
 * takes the place of the logotype and a gear opens the settings.
 */
export function TopBar({
  apps,
  onOpenFolders,
  isUnderPlatformBar = false
}: TopBarProps): ReactElement {
  const { t } = useI18n()
  const screenSize = useScreenSize()
  const isPhone = screenSize === 'mobile'
  const isDesktop = screenSize === 'desktop'
  const isEmbedded = useIsEmbedded()
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
  // Here, not in the field: on phones the field is not there until unfolded
  const searchActions = useRef<AppTopBarSearchActions>(null)
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
      // Inside Twake Workplace, the container shows the name of the app, and
      // the platform bar shows it above
      title={
        isUnderPlatformBar ? (
          folderTitle
        ) : isEmbedded ? null : (
          <>
            {isDesktop ? (
              <>
                <Icon
                  icon={TwakeWorkplace}
                  size={32}
                  preserveColor
                  aria-hidden="true"
                  data-testid="workplace-logo"
                />
                <Divider
                  orientation="vertical"
                  flexItem
                  className="u-mh-1 u-mv-half"
                />
              </>
            ) : null}
            <AppTitle />
          </>
        )
      }
      compactTitle={folderTitle ?? undefined}
      search={<MailSearchBar />}
      actions={
        <>
          {isPhone ? <ListFilterSlot /> : null}
          <HelpButton />
          {isUnderPlatformBar ? (
            <SettingsButton />
          ) : (
            <>
              {isPhone ? null : <AppGridMenu apps={apps} />}
              <UserMenu />
            </>
          )}
        </>
      }
      menu={{
        label: t('topbar.showFolders'),
        onOpen: onOpenFolders,
        'data-testid': 'mobile-mailbox-menu-button'
      }}
      openSearchLabel={t('topbar.search')}
      closeSearchLabel={t('common.back')}
      searchActions={searchActions}
      testIds={SEARCH_TEST_IDS}
      data-testid="top-bar"
    />
  )
}
