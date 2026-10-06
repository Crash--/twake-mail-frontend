import { Pen } from '@linagora/twake-icons'
import { Box, Layout } from '@linagora/twake-mui'
import { useState, type ReactElement, type ReactNode } from 'react'
import { Outlet, useLocation, useMatch } from 'react-router'

import { FlatContent, FlatMain } from '@/ds/FlatPanes/FlatPanes'
import { FloatingActionButton } from '@/ds/FloatingActionButton/FloatingActionButton'
import { TouchTargets } from '@/ds/TouchTargets/TouchTargets'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import type { AppListEntry } from '@common/config/config'
import {
  ComposerProvider,
  useComposer
} from '@common/features/composer/ComposerProvider'
import { OfflineNotice } from '@common/features/network/OfflineNotice'
import { LoadingAnnouncer } from '@common/features/loading/LoadingAnnouncer'
import { LabelActionsProvider } from '@common/features/labels/LabelActionsProvider'
import { ListFilterProvider } from '@common/features/thread/ListFilterProvider'
import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import { FolderActionsProvider } from '@common/features/mailboxActions/FolderActionsProvider'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import {
  isSettingsPath,
  SettingsExitProvider
} from '@common/features/settings/SettingsExitProvider'
import { FeedbackWidget } from '@common/features/sentry/FeedbackWidget'
import { SentryReportingSync } from '@common/features/sentry/SentryReportingSync'
import { ServerLanguageSync } from '@common/features/settings/ServerLanguageSync'
import { SettingsSidebar } from '@common/features/settings/SettingsSidebar'
import {
  ShortcutsProvider,
  useShortcuts
} from '@common/features/shortcuts/ShortcutsProvider'
import { QuotaBanner } from '@common/features/quota/QuotaBanner'
import {
  RecoveryBanner,
  RecoveryProvider
} from '@common/features/recovery/RecoveryProvider'
import { VacationBanner } from '@common/features/vacation/VacationBanner'
import { useI18n } from '@common/i18n/useI18n'

import { MailSidebar } from './MailSidebar'
import { MailSearchRow } from './MailSearchRow'
import { TopBar } from './TopBar'

export interface AppLayoutProps {
  apps: readonly AppListEntry[]
}

/**
 * Frame of the signed-in pages: top bar, sidebar, and the routed content.
 * Below the desktop size the sidebar is a drawer, closed as soon as the user
 * goes somewhere, and "New message" a floating button, hidden while an email
 * fills the screen. In the settings, a desktop shows their sections in
 * the sidebar. The keyboard shortcuts, the folder picker, the folder
 * actions and the composers work in all of it.
 */
export function AppLayout(props: AppLayoutProps): ReactElement {
  return (
    <MailProviders>
      <AppFrame {...props} />
    </MailProviders>
  )
}

/**
 * What the mail screens need around them: shortcuts, folder picker,
 * recovery, folder and label actions, composers, list filter
 */
export function MailProviders({
  children
}: {
  children: ReactNode
}): ReactElement {
  return (
    <ShortcutsProvider>
      <MailboxPickerProvider>
        <RecoveryProvider>
          <FolderActionsProvider>
            <LabelActionsProvider>
              <ComposerProvider>
                <SettingsExitProvider>
                  <ListFilterProvider>
                    <LoadingAnnouncer>{children}</LoadingAnnouncer>
                  </ListFilterProvider>
                </SettingsExitProvider>
              </ComposerProvider>
            </LabelActionsProvider>
          </FolderActionsProvider>
        </RecoveryProvider>
      </MailboxPickerProvider>
    </ShortcutsProvider>
  )
}

function AppFrame({ apps }: AppLayoutProps): ReactElement {
  const { t } = useI18n()
  const { undoLast } = useNotify()
  const screenSize = useScreenSize()
  const isDesktop = screenSize === 'desktop'
  const location = useLocation()
  // The location the drawer was opened at: any navigation closes it
  const [drawerLocationKey, setDrawerLocationKey] = useState<string | null>(
    null
  )
  const isDrawerOpen = drawerLocationKey === location.key
  const isMailboxEmailOpen =
    useMatch('/mailbox/:mailboxId/email/:emailId/*') !== null
  const isSearchEmailOpen = useMatch('/search/email/:emailId/*') !== null
  const isEmailOpen = isMailboxEmailOpen || isSearchEmailOpen
  const isSettings = isSettingsPath(location.pathname)
  const showComposeFab =
    !isDesktop && !isSettings && (!isEmailOpen || screenSize === 'tabletLarge')

  const handleOpenFolders = (): void => {
    setDrawerLocationKey(location.key)
  }

  const handleCloseFolders = (): void => {
    setDrawerLocationKey(null)
  }

  const { openComposer } = useComposer()
  // Both "New message" buttons and the `c` shortcut
  const handleCompose = (): void => {
    openComposer()
  }

  useShortcuts({
    c: handleCompose,
    z: () => {
      undoLast()
    }
  })

  return (
    <Box className="u-flex u-flex-column u-h-100">
      <TouchTargets />
      <ServerLanguageSync />
      <OfflineNotice />
      <SentryReportingSync />
      <FeedbackWidget hasFloatingAction={showComposeFab} />
      <TopBar apps={apps} onOpenFolders={handleOpenFolders} />
      {/* The top bar is in the flow, not fixed over the layout: no room to
          reserve for it (docs/twake-mui-gaps.md) */}
      <Layout
        className="u-flex-auto u-ov-hidden"
        withTopBar={false}
        monoColumn={!isDesktop}
      >
        {isSettings && isDesktop ? (
          <SettingsSidebar />
        ) : (
          <MailSidebar
            apps={apps}
            isDrawerOpen={isDrawerOpen}
            onDrawerClose={handleCloseFolders}
            onCompose={handleCompose}
          />
        )}
        <FlatMain>
          {isDesktop && !isSettings ? <MailSearchRow /> : null}
          <VacationBanner />
          <RecoveryBanner />
          <QuotaBanner />
          <FlatContent data-testid="main-content">
            <Outlet />
          </FlatContent>
        </FlatMain>
      </Layout>
      {showComposeFab ? (
        <FloatingActionButton
          label={t('sidebar.newMessage')}
          icon={Pen}
          onClick={handleCompose}
          data-testid="compose-email-button"
        />
      ) : null}
    </Box>
  )
}
