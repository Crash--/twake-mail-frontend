import { Typography } from '@linagora/twake-mui'
import { useRef, type ReactElement } from 'react'
import { useMatch } from 'react-router'

import {
  AppTopBar,
  type AppTopBarSearchActions
} from '@/ds/AppTopBar/AppTopBar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useCurrentMailboxName } from '@common/features/mailbox/useCurrentMailboxName'
import { LABEL_PATH } from '@common/features/labels/labelPaths'
import { useLabels } from '@common/features/labels/queries'
import { SETTINGS_PATH } from '@common/features/settings/sections'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'
import { ListFilterSlot } from '@common/features/thread/ListFilterProvider'
import { useI18n } from '@common/i18n/useI18n'

import { HelpButton } from './HelpButton'
import { MailSearchBar } from './MailSearchBar'
import { SettingsButton } from './SettingsButton'

const SEARCH_TEST_IDS = {
  openSearch: 'search-open-button',
  closeSearch: 'search-back-button'
}

export interface TopBarProps {
  /** Opens the folder drawer */
  onOpenFolders: () => void
}

/**
 * The bar of the mail below the desktop size, under the platform bar: a
 * button opening the folders, the current folder, the search (folded behind
 * a button on phones), the help and the settings
 */
export function TopBar({ onOpenFolders }: TopBarProps): ReactElement {
  const { t } = useI18n()
  const screenSize = useScreenSize()
  const isPhone = screenSize === 'mobile'
  const isDesktop = screenSize === 'desktop'
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
      title={folderTitle}
      compactTitle={folderTitle ?? undefined}
      search={<MailSearchBar />}
      actions={
        <>
          {isPhone ? <ListFilterSlot /> : null}
          <HelpButton />
          <SettingsButton />
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
