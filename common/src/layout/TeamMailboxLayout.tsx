import { Burger, Icon, Pen } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  Layout,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'
import { Outlet, useLocation, useMatch } from 'react-router'

import { ComposeButton } from '@/ds/ComposeButton/ComposeButton'
import { FlatContent, FlatMain } from '@/ds/FlatPanes/FlatPanes'
import { FloatingActionButton } from '@/ds/FloatingActionButton/FloatingActionButton'
import { ResponsiveSidebar } from '@/ds/ResponsiveSidebar/ResponsiveSidebar'
import { TouchTargets } from '@/ds/TouchTargets/TouchTargets'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { useCurrentMailboxName } from '@common/features/mailbox/useCurrentMailboxName'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { SentryReportingSync } from '@common/features/sentry/SentryReportingSync'
import { ServerLanguageSync } from '@common/features/settings/ServerLanguageSync'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'
import {
  useTeamMailboxEmbed,
  useTeamMailboxRoot
} from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import { TeamMailboxTree } from '@common/features/teamMailboxEmbed/TeamMailboxTree'
import { useI18n } from '@common/i18n/useI18n'

import { MailProviders } from './AppLayout'

/**
 * Frame of the facade of a team mailbox (`/embed/team-mailboxes/<id>`),
 * shown in the Mail tab of a TwakeSpace space: no top bar, app grid,
 * account menu, labels nor banners, only the folders of the mailbox and
 * the routed content. Below the desktop size the folders are in a drawer,
 * opened from a bar holding the name of the current folder, and "New
 * message" is a floating button.
 */
export function TeamMailboxLayout(): ReactElement {
  return (
    <MailProviders>
      <TeamMailboxFrame />
    </MailProviders>
  )
}

function TeamMailboxFrame(): ReactElement {
  const { t } = useI18n()
  const { undoLast } = useNotify()
  const rootId = useTeamMailboxEmbed() ?? ''
  const root = useTeamMailboxRoot()
  const screenSize = useScreenSize()
  const isDesktop = screenSize === 'desktop'
  const location = useLocation()
  const folderName = useCurrentMailboxName()
  // The location the drawer was opened at: any navigation closes it
  const [drawerLocationKey, setDrawerLocationKey] = useState<string | null>(
    null
  )
  const isDrawerOpen = drawerLocationKey === location.key
  const isEmailOpen = useMatch('/mailbox/:mailboxId/email/:emailId/*') !== null
  const showComposeFab =
    !isDesktop && (!isEmailOpen || screenSize === 'tabletLarge')

  const handleOpenFolders = (): void => {
    setDrawerLocationKey(location.key)
  }

  const handleCloseFolders = (): void => {
    setDrawerLocationKey(null)
  }

  const { openComposer } = useComposer()
  // Both "New message" buttons and the `c` shortcut; the composer writes
  // from the address of the team mailbox
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
      <SentryReportingSync />
      {isDesktop ? null : (
        <Box
          className="u-flex u-flex-items-center u-ph-half"
          component="header"
          data-testid="team-mailbox-bar"
        >
          <Tooltip title={t('topbar.showFolders')}>
            <IconButton
              edge="start"
              aria-label={t('topbar.showFolders')}
              aria-haspopup="dialog"
              onClick={handleOpenFolders}
              data-testid="mobile-mailbox-menu-button"
            >
              <Icon icon={Burger} />
            </IconButton>
          </Tooltip>
          <Typography variant="h6" component="h1" noWrap>
            {folderName ?? root?.name}
          </Typography>
        </Box>
      )}
      <Layout
        className="u-flex-auto u-ov-hidden"
        withTopBar={false}
        monoColumn={!isDesktop}
      >
        <ResponsiveSidebar
          open={isDrawerOpen}
          onClose={handleCloseFolders}
          label={t('layout.navigation')}
          closeLabel={t('common.close')}
          data-testid="sidebar"
          drawerTestId="mailbox-drawer"
          closeButtonTestId="mailbox-drawer-close-button"
        >
          {isDesktop ? (
            <Box className="u-mh-1 u-mt-1">
              <ComposeButton
                label={t('sidebar.newMessage')}
                icon={Pen}
                onClick={handleCompose}
                data-testid="compose-email-button"
              />
            </Box>
          ) : null}
          <Box
            className="u-flex-auto u-ov-auto u-mt-1-half"
            data-testid="sidebar-scroll"
          >
            <TeamMailboxTree rootId={rootId} />
          </Box>
        </ResponsiveSidebar>
        <FlatMain>
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
