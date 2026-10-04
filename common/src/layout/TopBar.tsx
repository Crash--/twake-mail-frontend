import { Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useMatch } from 'react-router'

import { AppTopBar } from '@/ds/AppTopBar/AppTopBar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import type { AppListEntry } from '@common/config/config'
import { useCurrentMailboxName } from '@common/features/mailbox/useCurrentMailboxName'
import { useI18n } from '@common/i18n/useI18n'
import { AppTitle } from '@injected/layout/AppTitle'

import { AppGridMenu } from './AppGridMenu'
import { MailSearchBar } from './MailSearchBar'
import { UserMenu } from './UserMenu'

const SEARCH_TEST_IDS = {
  openSearch: 'search-open-button',
  closeSearch: 'search-back-button'
}

export interface TopBarProps {
  apps: readonly AppListEntry[]
  /** Opens the folder drawer, below the desktop size */
  onOpenFolders: () => void
}

/**
 * Logotype, search, app grid and account menu. Below the desktop size a
 * button opens the folders; phones show the current folder instead of the
 * logotype (which moves to the drawer, with the app grid) and fold the
 * search behind a button.
 */
export function TopBar({ apps, onOpenFolders }: TopBarProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const mailboxName = useCurrentMailboxName()
  const isSearch = useMatch('/search/*') !== null
  const folderName = isSearch ? t('search.title') : mailboxName

  return (
    <AppTopBar
      title={<AppTitle />}
      compactTitle={
        folderName === null ? undefined : (
          <Typography
            variant="h4"
            component="span"
            noWrap
            data-testid="top-bar-folder-name"
          >
            {folderName}
          </Typography>
        )
      }
      search={<MailSearchBar />}
      actions={
        <>
          {isPhone ? null : <AppGridMenu apps={apps} />}
          <UserMenu />
        </>
      }
      menu={{
        label: t('topbar.showFolders'),
        onOpen: onOpenFolders,
        'data-testid': 'mobile-mailbox-menu-button'
      }}
      openSearchLabel={t('topbar.search')}
      closeSearchLabel={t('common.back')}
      testIds={SEARCH_TEST_IDS}
      data-testid="top-bar"
    />
  )
}
