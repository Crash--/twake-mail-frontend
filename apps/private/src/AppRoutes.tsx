import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import type { AppListEntry } from '@common/config/config'
import { BasicLoginPage } from '@common/features/auth/BasicLoginPage'
import { LoginCallbackPage } from '@common/features/auth/LoginCallbackPage'
import { RequireAuth } from '@common/features/auth/RequireAuth'
import { DefaultMailboxRedirect } from '@common/features/mailbox/DefaultMailboxRedirect'
import { JmapSessionProvider } from '@common/jmap/JmapSessionProvider'
import { AppLayout } from '@common/layout/AppLayout'

import { EmailPage } from './features/mailbox/EmailPage'
import { MailboxPage } from './features/mailbox/MailboxPage'

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
          <Route index element={<DefaultMailboxRedirect />} />
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
