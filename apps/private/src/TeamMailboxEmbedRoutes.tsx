import type { ReactElement } from 'react'
import { Navigate, Route } from 'react-router'

import { BasicLoginPage } from '@common/features/auth/BasicLoginPage'
import { RequireAuth } from '@common/features/auth/RequireAuth'
import { DefaultMailboxRedirect } from '@common/features/mailbox/DefaultMailboxRedirect'
import { PushProvider } from '@common/features/push/PushProvider'
import { JmapSessionProvider } from '@common/jmap/JmapSessionProvider'
import { TeamMailboxLayout } from '@common/layout/TeamMailboxLayout'

import { EmailPage } from './features/mailbox/EmailPage'
import { MailboxPage } from './features/mailbox/MailboxPage'
import { RouteErrorScreen } from './RouteErrorScreen'

/**
 * The routes of the facade of a team mailbox, under the base
 * `/embed/team-mailboxes/<address>`: its folders and their emails only.
 * Any other path, and a folder of another mailbox, lead to its Inbox.
 */
export function teamMailboxEmbedRouteElements(): ReactElement {
  return (
    <Route errorElement={<RouteErrorScreen />}>
      <Route path="/login" element={<BasicLoginPage />} />
      <Route element={<RequireAuth />}>
        <Route
          element={
            <JmapSessionProvider>
              <PushProvider>
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
