import { Pen } from '@linagora/twake-icons'
import { Box, Layout } from '@linagora/twake-mui'
import { useState, type ReactElement, type ReactNode } from 'react'
import { Outlet, useLocation, useMatch } from 'react-router'

import { FlatContent, FlatMain } from '@/ds/FlatPanes/FlatPanes'
import { FloatingActionButton } from '@/ds/FloatingActionButton/FloatingActionButton'
import { SCRIPT_FOCUS_TARGET } from '@/ds/FocusIndicator/focusIndicator'
import { SearchRow } from '@/ds/SearchRow/SearchRow'
import { SkipLink } from '@/ds/SkipLink/SkipLink'
import { TouchTargets } from '@/ds/TouchTargets/TouchTargets'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  ComposerProvider,
  useComposer
} from '@common/features/composer/ComposerProvider'
import { OfflineNotice } from '@common/features/network/OfflineNotice'
import { LoadingAnnouncer } from '@common/features/loading/LoadingAnnouncer'
import { LabelActionsProvider } from '@common/features/labels/LabelActionsProvider'
import { ListFilterProvider } from '@common/features/thread/ListFilterProvider'
import { InboxUnreadTitle } from '@common/features/mailbox/InboxUnreadTitle'
import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import { FolderActionProgressProvider } from '@common/features/mailboxActions/FolderActionProgress'
import { FolderActionProgressBanner } from '@common/features/mailboxActions/FolderActionProgressBanner'
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
import {
  PlatformProvider,
  usePlatformSdk
} from '@common/features/platform/PlatformProvider'
import { useI18n } from '@common/i18n/useI18n'

import { AppHeader } from './AppHeader'
import { MailSidebar } from './MailSidebar'
import { MailSearchRow } from './MailSearchRow'
import { SettingsButton } from './SettingsButton'
import { useFocusMainOnNavigation } from './useFocusMainOnNavigation'

/** The target of the skip link and of the focus after a navigation */
const MAIN_CONTENT_ID = 'main-content'

/**
 * Frame of the signed-in pages: the platform bar of Twake Workplace (and
 * the bar of the mail below the desktop size), sidebar, and the routed
 * content.
 * Below the desktop size the sidebar is a drawer, closed as soon as the user
 * goes somewhere, and "New message" a floating button, hidden while an email
 * fills the screen. In the settings, a desktop shows their sections in
 * the sidebar. The keyboard shortcuts, the folder picker, the folder
 * actions and the composers work in all of it.
 */
export function AppLayout(): ReactElement {
  return (
    <MailProviders>
      <PlatformProvider>
        <AppFrame />
      </PlatformProvider>
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
          <FolderActionProgressProvider>
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
          </FolderActionProgressProvider>
        </RecoveryProvider>
      </MailboxPickerProvider>
    </ShortcutsProvider>
  )
}

function AppFrame(): ReactElement {
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
  // The search is in the platform bar, unless the Workplace frames the app
  const hasPlatformBar = usePlatformSdk() !== null
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

  useFocusMainOnNavigation(MAIN_CONTENT_ID)

  useShortcuts({
    c: handleCompose,
    z: () => {
      undoLast()
    }
  })

  return (
    <Box className="u-flex u-flex-column u-h-100">
      <SkipLink
        label={t('app.skipToContent')}
        targetId={MAIN_CONTENT_ID}
        data-testid="skip-to-content"
      />
      <TouchTargets />
      <ServerLanguageSync />
      <InboxUnreadTitle />
      <OfflineNotice />
      <SentryReportingSync />
      {/* The reply bar of an open email is at the bottom of the screen too */}
      <FeedbackWidget hasBottomAction={showComposeFab || isEmailOpen} />
      <AppHeader onOpenFolders={handleOpenFolders} />
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
            isDrawerOpen={isDrawerOpen}
            onDrawerClose={handleCloseFolders}
            onCompose={handleCompose}
          />
        )}
        <FlatMain inset={isDesktop}>
          {isDesktop && !isSettings && !hasPlatformBar ? (
            <SearchRow
              search={<MailSearchRow />}
              actions={<SettingsButton />}
              data-testid="search-row"
            />
          ) : null}
          <VacationBanner />
          <RecoveryBanner />
          <FolderActionProgressBanner />
          <QuotaBanner />
          <FlatContent
            id={MAIN_CONTENT_ID}
            tabIndex={-1}
            {...SCRIPT_FOCUS_TARGET}
            data-testid="main-content"
          >
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
