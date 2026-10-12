import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Outlet, useMatch } from 'react-router'

import { ComposeButton } from '@/ds/ComposeButton/ComposeButton'
import { FloatingActionButton } from '@/ds/FloatingActionButton/FloatingActionButton'
import { Pen } from '@/ds/FlutterIcons/FlutterIcons'
import { TouchTargets } from '@/ds/TouchTargets/TouchTargets'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { OfflineNotice } from '@common/features/network/OfflineNotice'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { SentryReportingSync } from '@common/features/sentry/SentryReportingSync'
import { ServerLanguageSync } from '@common/features/settings/ServerLanguageSync'
import { ServerThemeSync } from '@common/features/settings/ServerThemeSync'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'
import { useTeamMailboxRoot } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import { ListToolbarActionProvider } from '@common/features/thread/ListToolbarAction'
import { useI18n } from '@common/i18n/useI18n'

import { MailProviders } from './AppLayout'
import { TeamMailboxPane } from './TeamMailboxPane'

/**
 * Frame of the facade of a team mailbox (`/embed/team-mailboxes/<id>`),
 * shown in the Mail tab of a TwakeSpace space: the routed content only, no
 * top bar, sidebar, app grid, account menu nor banners. "New message" is at
 * the end of the toolbar above the list, and a floating button on phones
 * (where the list has no toolbar), hidden while an email fills the screen
 * (its answer bar is at the bottom). There is none while the team mailbox is
 * not found (loading, or unavailable to the user): there is no team address
 * to write from. No tablet layouts (`WithoutTablets`, set by the app): an
 * email always fills the screen.
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
  const screenSize = useScreenSize()
  const isEmailOpen = useMatch('/mailbox/:mailboxId/email/:emailId/*') !== null
  const canCompose = useTeamMailboxRoot() !== null

  const { openComposer } = useComposer()
  // The button and the `c` shortcut; the composer writes from the address
  // of the team mailbox, never from the personal one
  const handleCompose = (): void => {
    if (canCompose) openComposer()
  }

  useShortcuts({
    c: handleCompose,
    z: () => {
      undoLast()
    }
  })

  const label = t('sidebar.newMessage')
  const isPhone = screenSize === 'mobile'

  return (
    <Box className="u-flex u-flex-column u-h-100">
      <TouchTargets />
      <ServerLanguageSync />
      <ServerThemeSync />
      <SentryReportingSync />
      <OfflineNotice />
      <ListToolbarActionProvider
        action={
          canCompose && !isPhone ? (
            <ComposeButton
              label={label}
              icon={Pen}
              onClick={handleCompose}
              placement="toolbar"
              data-testid="compose-email-button"
            />
          ) : null
        }
      >
        <TeamMailboxPane data-testid="main-content">
          <Outlet />
        </TeamMailboxPane>
      </ListToolbarActionProvider>
      {isPhone && canCompose && !isEmailOpen ? (
        <FloatingActionButton
          label={label}
          icon={Pen}
          onClick={handleCompose}
          data-testid="compose-email-button"
        />
      ) : null}
    </Box>
  )
}
