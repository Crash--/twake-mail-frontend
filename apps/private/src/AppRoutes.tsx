import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import type { AppListEntry } from '@common/config/config'
import { BasicLoginPage } from '@common/features/auth/BasicLoginPage'
import { LoginCallbackPage } from '@common/features/auth/LoginCallbackPage'
import { RequireAuth } from '@common/features/auth/RequireAuth'
import { JmapSessionProvider } from '@common/jmap/JmapSessionProvider'
import { AppLayout } from '@common/layout/AppLayout'

import { EmailPage } from './features/mailbox/EmailPage'
import { MailboxPage } from './features/mailbox/MailboxPage'

/**
 * Mailbox the app opens on. A role name until the mailboxes are fetched.
 * TODO(jmap-client-ts v2): redirect to the id of the mailbox of role inbox.
 */
export const DEFAULT_MAILBOX_ID = 'inbox'

export interface AppRoutesProps {
  apps: readonly AppListEntry[]
}

export function AppRoutes({ apps }: AppRoutesProps): ReactElement {
  return (
    <Routes>
      <Route path="/callback" element={<LoginCallbackPage />} />
      <Route path="/login" element={<BasicLoginPage />} />
      <Route element={<RequireAuth />}>
        <Route
          element={
            <JmapSessionProvider>
              <AppLayout apps={apps} />
            </JmapSessionProvider>
          }
        >
          <Route
            index
            element={<Navigate to={`/mailbox/${DEFAULT_MAILBOX_ID}`} replace />}
          />
          <Route path="/mailbox/:mailboxId" element={<MailboxPage />} />
          <Route
            path="/mailbox/:mailboxId/email/:emailId"
            element={<EmailPage />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
