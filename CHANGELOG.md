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

### Security

- Session tokens and basic credentials are kept in memory, out of web storage
- OIDC codes, states, tokens and tickets are masked in nginx logs and in the
  reports sent to Sentry
