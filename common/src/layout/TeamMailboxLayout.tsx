import { Pen } from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Outlet, useMatch } from 'react-router'

import { FlatContent, FlatMain } from '@/ds/FlatPanes/FlatPanes'
import {
  AlwaysFloatingAction,
  FloatingActionButton
} from '@/ds/FloatingActionButton/FloatingActionButton'
import { TouchTargets } from '@/ds/TouchTargets/TouchTargets'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { OfflineNotice } from '@common/features/network/OfflineNotice'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { SentryReportingSync } from '@common/features/sentry/SentryReportingSync'
import { ServerLanguageSync } from '@common/features/settings/ServerLanguageSync'
import { useShortcuts } from '@common/features/shortcuts/ShortcutsProvider'
import { useI18n } from '@common/i18n/useI18n'

import { MailProviders } from './AppLayout'

/**
 * Frame of the facade of a team mailbox (`/embed/team-mailboxes/<id>`),
 * shown in the Mail tab of a TwakeSpace space: the routed content only, no
 * top bar, sidebar, app grid, account menu nor banners. "New message" is a
 * floating button at every size, hidden while an email fills the screen
 * (its answer bar is at the bottom).
 */
export function TeamMailboxLayout(): ReactElement {
  return (
    <MailProviders>
      <AlwaysFloatingAction>
        <TeamMailboxFrame />
      </AlwaysFloatingAction>
    </MailProviders>
  )
}

function TeamMailboxFrame(): ReactElement {
  const { t } = useI18n()
  const { undoLast } = useNotify()
  const screenSize = useScreenSize()
  const isEmailOpen = useMatch('/mailbox/:mailboxId/email/:emailId/*') !== null
  const showComposeFab = !isEmailOpen || screenSize === 'tabletLarge'

  const { openComposer } = useComposer()
  // The floating button and the `c` shortcut; the composer writes from the
  // address of the team mailbox
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
      <OfflineNotice hasFloatingAction />
      <Box className="u-flex u-flex-auto u-ov-hidden">
        <FlatMain>
          <FlatContent data-testid="main-content">
            <Outlet />
          </FlatContent>
        </FlatMain>
      </Box>
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
