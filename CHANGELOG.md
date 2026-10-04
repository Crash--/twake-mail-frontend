# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Application skeleton: npm workspaces (`apps/private`, `common`), Rsbuild,
  React 18, TypeScript strict, `@linagora/twake-mui`, TanStack Query
- Runtime configuration (`.env.js`, `appList.js`, `version.js`), validated at
  startup, with an explicit screen when it is invalid
- OIDC sign-in (Authorization Code + PKCE), token refresh before expiry and on
  401, logout ending the session in every tab
- Basic sign-in form, checked against the JMAP session endpoint
- Layout: top bar (search field, app grid, user menu), sidebar (new message
  button, mailbox tree slot), mailbox and email routes
- English, French, Russian and Vietnamese translations
- Docker image (nginx) and CI workflow
- JMAP client (jmap-client-ts v2): one client per sign-in, JMAP session
  loaded before the mail screens, its username shown in the user menu in
  basic mode
- Folder tree: nested folders sorted as in tmail-flutter, translated system
  folder names, unread counters, expand and collapse; the app opens on the
  inbox
- Email list: paginated and virtualized, unread and starred state, star
  toggle, empty folder view
- Reading an email: headers, sanitized HTML body (or text), inline images,
  attachments to download, back to the list; marked read when opened
- Real-time updates through JMAP push over WebSocket
- Development proxy to a JMAP server (`JMAP_PROXY_TARGET`)
- End-to-end tests of login, folders, reading and push (Playwright)

### Security

- Session tokens and basic credentials are kept in memory, out of web storage
- OIDC codes, states, tokens and tickets are masked in nginx logs and in the
  reports sent to Sentry
- Email bodies are sanitized with DOMPurify and displayed in an iframe that
  cannot run scripts, under a Content Security Policy forbidding them
