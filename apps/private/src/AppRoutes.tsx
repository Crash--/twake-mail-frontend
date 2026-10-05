import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import type { AppListEntry } from '@common/config/config'
import { BasicLoginPage } from '@common/features/auth/BasicLoginPage'
import { LoginCallbackPage } from '@common/features/auth/LoginCallbackPage'
import { RequireAuth } from '@common/features/auth/RequireAuth'
import { MailtoRoute } from '@common/features/composer/MailtoRoute'
import { ForwardSettings } from '@common/features/forward/ForwardSettings'
import { IdentitiesSettings } from '@common/features/identities/IdentitiesSettings'
import { FolderVisibilitySettings } from '@common/features/mailbox/FolderVisibilitySettings'
import { DefaultMailboxRedirect } from '@common/features/mailbox/DefaultMailboxRedirect'
import { EmailRulesSettings } from '@common/features/rules/EmailRulesSettings'
import { PushProvider } from '@common/features/push/PushProvider'
import { LanguageSettings } from '@common/features/settings/LanguageSettings'
import { PreferencesSettings } from '@common/features/settings/PreferencesSettings'
import {
  SettingsHome,
  SettingsSectionRoute
} from '@common/features/settings/SettingsRoutes'
import { ShortcutsSettings } from '@common/features/settings/ShortcutsSettings'
import { VacationSettings } from '@common/features/vacation/VacationSettings'
import { JmapSessionProvider } from '@common/jmap/JmapSessionProvider'
import { AppLayout } from '@common/layout/AppLayout'

import { LabelEmailPage } from './features/labels/LabelEmailPage'
import { LabelPage } from './features/labels/LabelPage'
import { EmailPage } from './features/mailbox/EmailPage'
import { MailboxPage } from './features/mailbox/MailboxPage'
import { SearchEmailPage } from './features/search/SearchEmailPage'
import { SearchPage } from './features/search/SearchPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { StarredEmailPage } from './features/starred/StarredEmailPage'
import { StarredPage } from './features/starred/StarredPage'
import { RouteErrorScreen } from './RouteErrorScreen'

export interface AppRoutesProps {
  apps: readonly AppListEntry[]
}

/**
 * The routes of the app, as `<Route>` elements: the data router of the app
 * is made from them (`createRoutesFromElements`), so that every page is a
 * data route and its navigations can run as view transitions; `AppRoutes`
 * renders them under any router (tests).
 */
export function appRouteElements({ apps }: AppRoutesProps): ReactElement {
  return (
    // The data router shows `errorElement` when a page fails to render
    <Route errorElement={<RouteErrorScreen />}>
      <Route path="/callback" element={<LoginCallbackPage />} />
      <Route path="/login" element={<BasicLoginPage />} />
      <Route element={<RequireAuth />}>
        <Route
          element={
            <JmapSessionProvider>
              <PushProvider>
                <AppLayout apps={apps} />
              </PushProvider>
            </JmapSessionProvider>
          }
        >
          <Route index element={<DefaultMailboxRedirect />} />
          <Route path="/mailto" element={<MailtoRoute />} />
          <Route path="/mailbox/:mailboxId" element={<MailboxPage />}>
            <Route path="email/:emailId" element={<EmailPage />} />
          </Route>
          <Route path="/starred" element={<StarredPage />}>
            <Route path="email/:emailId" element={<StarredEmailPage />} />
          </Route>
          <Route path="/label/:labelId" element={<LabelPage />}>
            <Route path="email/:emailId" element={<LabelEmailPage />} />
          </Route>
          <Route path="/search" element={<SearchPage />}>
            <Route path="email/:emailId" element={<SearchEmailPage />} />
          </Route>
          <Route path="/settings" element={<SettingsPage />}>
            <Route index element={<SettingsHome />} />
            <Route
              path="profiles"
              element={
                <SettingsSectionRoute id="profiles">
                  {section => <IdentitiesSettings section={section} />}
                </SettingsSectionRoute>
              }
            />
            <Route
              path="email-rules"
              element={
                <SettingsSectionRoute id="email-rules">
                  {section => <EmailRulesSettings section={section} />}
                </SettingsSectionRoute>
              }
            />
            <Route
              path="preferences"
              element={
                <SettingsSectionRoute id="preferences">
                  {section => <PreferencesSettings section={section} />}
                </SettingsSectionRoute>
              }
            />
            <Route
              path="forwarding"
              element={
                <SettingsSectionRoute id="forwarding">
                  {section => <ForwardSettings section={section} />}
                </SettingsSectionRoute>
              }
            />
            <Route
              path="vacation"
              element={
                <SettingsSectionRoute id="vacation">
                  {section => <VacationSettings section={section} />}
                </SettingsSectionRoute>
              }
            />
            <Route
              path="folder-visibility"
              element={
                <SettingsSectionRoute id="folder-visibility">
                  {section => <FolderVisibilitySettings section={section} />}
                </SettingsSectionRoute>
              }
            />
            <Route
              path="language-region"
              element={
                <SettingsSectionRoute id="language-region">
                  {section => <LanguageSettings section={section} />}
                </SettingsSectionRoute>
              }
            />
            <Route
              path="keyboard-shortcuts"
              element={
                <SettingsSectionRoute id="keyboard-shortcuts">
                  {section => <ShortcutsSettings section={section} />}
                </SettingsSectionRoute>
              }
            />
            <Route path="*" element={<Navigate to="/settings" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Route>
  )
}

export function AppRoutes(props: AppRoutesProps): ReactElement {
  return <Routes>{appRouteElements(props)}</Routes>
}
