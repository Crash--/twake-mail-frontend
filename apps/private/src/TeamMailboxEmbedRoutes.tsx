import type { ReactElement } from 'react'
import { Navigate, Route } from 'react-router'

import { BasicLoginPage } from '@common/features/auth/BasicLoginPage'
import { RequireAuth } from '@common/features/auth/RequireAuth'
import { DefaultMailboxRedirect } from '@common/features/mailbox/DefaultMailboxRedirect'
import { PushProvider } from '@common/features/push/PushProvider'
import type { SpaceBridge } from '@common/features/teamMailboxEmbed/spaceBridge'
import { TeamMailboxBadges } from '@common/features/teamMailboxEmbed/TeamMailboxBadges'
import { JmapSessionProvider } from '@common/jmap/JmapSessionProvider'
import { TeamMailboxLayout } from '@common/layout/TeamMailboxLayout'
import { TeamMailboxLoadingScreen } from '@common/layout/TeamMailboxLoadingScreen'

import { EmailPage } from './features/mailbox/EmailPage'
import { MailboxPage } from './features/mailbox/MailboxPage'
import { RouteErrorScreen } from './RouteErrorScreen'

/**
 * The routes of the facade of a team mailbox, under the base
 * `/embed/team-mailboxes/<address>`: its folders and their emails only.
 * Any other path, and a folder of another mailbox, lead to its Inbox.
 * While the login and the session load, the rows of a list stand in. In a
 * frame of TwakeSpace, the unread counts of the team mailboxes go to its tabs.
 */
export function teamMailboxEmbedRouteElements(
  spaceBridge: SpaceBridge | null = null
): ReactElement {
  return (
    <Route errorElement={<RouteErrorScreen />}>
      <Route path="/login" element={<BasicLoginPage />} />
      <Route element={<RequireAuth loading={<TeamMailboxLoadingScreen />} />}>
        <Route
          element={
            <JmapSessionProvider loading={<TeamMailboxLoadingScreen />}>
              <PushProvider spaceBridge={spaceBridge}>
                {spaceBridge === null ? null : (
                  <TeamMailboxBadges reportBadges={spaceBridge.reportBadges} />
                )}
                <TeamMailboxLayout />
              </PushProvider>
            </JmapSessionProvider>
          }
        >
          <Route index element={<DefaultMailboxRedirect />} />
          <Route path="/mailbox/:mailboxId" element={<MailboxPage />}>
            <Route path="email/:emailId" element={<EmailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Route>
  )
}
