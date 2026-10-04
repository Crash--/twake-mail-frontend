import { Pen } from '@linagora/twake-icons'
import { Box, Content, Layout, Main } from '@linagora/twake-mui'
import { useCallback, useState, type ReactElement } from 'react'
import { Outlet, useLocation, useMatch } from 'react-router'

import { FloatingActionButton } from '@/ds/FloatingActionButton/FloatingActionButton'
import { TouchTargets } from '@/ds/TouchTargets/TouchTargets'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import type { AppListEntry } from '@common/config/config'
import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import { FolderActionsProvider } from '@common/features/mailboxActions/FolderActionsProvider'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import {
  ShortcutsProvider,
  useShortcuts
} from '@common/features/shortcuts/ShortcutsProvider'
import { useI18n } from '@common/i18n/useI18n'

import { MailSidebar } from './MailSidebar'
import { TopBar } from './TopBar'

export interface AppLayoutProps {
  apps: readonly AppListEntry[]
}

/**
 * Frame of the signed-in pages: top bar, sidebar, and the routed content.
 * Below the desktop size the sidebar is a drawer, closed as soon as the user
 * goes somewhere, and "New message" a floating button, hidden while an email
 * fills the screen. The keyboard shortcuts, the folder picker and the
 * folder actions work in all of it.
 */
export function AppLayout(props: AppLayoutProps): ReactElement {
  return (
    <ShortcutsProvider>
      <MailboxPickerProvider>
        <FolderActionsProvider>
          <AppFrame {...props} />
        </FolderActionsProvider>
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
  const showComposeFab =
    !isDesktop && (!isEmailOpen || screenSize === 'tabletLarge')

  const handleOpenFolders = (): void => {
    setDrawerLocationKey(location.key)
  }

  const handleCloseFolders = (): void => {
    setDrawerLocationKey(null)
  }

  // TODO: open the composer once it exists (phase 3): both "New message"
  // buttons and the `c` shortcut call this
  const handleCompose = useCallback((): void => undefined, [])

  useShortcuts({
    c: handleCompose,
    z: () => {
      undoLast()
    }
  })

  return (
    <Box className="u-flex u-flex-column u-h-100">
      <TouchTargets />
      <TopBar apps={apps} onOpenFolders={handleOpenFolders} />
      {/* The top bar is in the flow, not fixed over the layout: no room to
          reserve for it (docs/twake-mui-gaps.md) */}
      <Layout
        className="u-flex-auto u-ov-hidden"
        withTopBar={false}
        monoColumn={!isDesktop}
      >
        <MailSidebar
          apps={apps}
          isDrawerOpen={isDrawerOpen}
          onDrawerClose={handleCloseFolders}
          onCompose={handleCompose}
        />
        <Main>
          <Content data-testid="main-content">
            <Outlet />
          </Content>
        </Main>
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
