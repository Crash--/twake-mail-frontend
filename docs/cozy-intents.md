# Intents served by Twake Mail

Twake Mail is a [cozy-stack intent](https://github.com/linagora/cozy-stack/blob/master/docs/intents.md)
service: another app of the Workplace (Twake Chat…) asks it for a new message
with `cozy-interapp`, in a frame it shows in its own dialog. The standalone
app serves the intent itself, on its `/intents` page, outside any cozy-stack
subdomain (`service_url_flag`, linagora/cozy-stack#4965).

The embed facade (`/embed/…`, [`team-mailbox-embed.md`](team-mailbox-embed.md))
stays for Twake Space; an app that only needs the composer uses the intent.

## Contract

| Action | Type | Data | Result |
| --- | --- | --- | --- |
| `CREATE` | `io.cozy.mails` | `{ to?, cc?, bcc?, subject?, body? }` | `{ status: 'sent' }`, `{ status: 'draft', draftId }`, or `null` |

- `CREATE`: the verb of cozy-stack for "create one with these values"
  (`CREATE io.cozy.contacts` in its documentation), as Twake Calendar plans
  `CREATE io.cozy.calendar.events`. `io.cozy.mails` names a shape, no
  document of the stack: cozy-stack only matches the action and the type.
- Data: `to`, `cc` and `bcc` are arrays of addresses, `subject` a string,
  `body` plain text; every field is optional. Data of another shape fails the
  intent (`throw`).
- Result: sent, the client gets `{ status: 'sent' }`; closed with a draft,
  `{ status: 'draft', draftId }` (the JMAP id of the draft); closed without a
  draft, its draft deleted, or the frame removed by the client, the intent is
  cancelled and the client gets `null`.

```js
const intents = new Intents({ fetch }) // a token of the stack of the user
const result = await intents
  .create('CREATE', 'io.cozy.mails', { to: ['bob@example.com'] })
  .start(containerElement)
```

## The page

`/intents?intent=<id>` (`apps/private/src/IntentsApp.tsx`,
`common/src/features/intents/`):

1. Signs in silently (`prompt=none`): a frame never shows the login form of
   the SSO. The SSO comes back to `/intents/callback`, the redirect URI of
   the intents page, which only ends the login and goes back to
   `/intents?intent=<id>`; the callback of the webmail (`/callback`) stays
   unframable. When the SSO needs the user, the page says the session
   expired. Every path under `/intents` shows the intents page or an error,
   never the webmail.
2. Trades the ID token for a token of the cozy-stack of the user
   (`POST /auth/token_exchange`, `exchange_type: app`), at
   `TDRIVE_INTENT_URL` (read even when `TDRIVE_ENABLED` is off, default
   `https://{workplaceFqdn}`).
3. Reads the intent (`GET /intents/:id`) and waits for the data of the
   client (`cozy-interapp` `createService`), then shows the composer alone,
   filling the frame, with its own close button (it saves the draft): it asks
   the client to hide its own (`hideCross`), which would cancel the intent
   without the draft.

A session the SSO cannot renew while the user writes sends the frame to the
SSO: the page unloads, so the client gets `null`, even when an autosave kept
a draft (as the embed facade, the draft stays in Drafts).

Before the service exists nothing can be told to the client: the page shows
why (not in a frame, basic mode, token refused, `403` of the stack, no answer
of the client within 30 s), and the client keeps its own close button.

## Security model

The stack sets the `frame-ancestors` of the intent services it serves, from
the intent (`handleIntent` of cozy-stack: the client app and its cozy
subdomain). It cannot set them on a page it does not serve: `/intents` is
framed by any page (`frame-ancestors *`, on that path only), and these
guard it instead:

- **The handshake (always).** The page reads the intent from the stack with
  its own token: the stack gives the origin of the client app (`client`),
  from the token that created the intent. cozy-interapp sends `ready` to the
  parent window for that origin only, and ignores data from any other. The
  page shows a loader or an error until the client answered: a page that
  frames `/intents?intent=<id>` itself never gets the composer, and cannot
  create an intent of another app without its token.
- **The ancestors (when the stack and the browser tell them).** A stack
  with linagora/cozy-stack#4978 (optional) gives `frameAncestors` with the
  intent: the origins that may frame a service of it, those it would put in
  `frame-ancestors`. When it does and
  the browser has `location.ancestorOrigins`, every page above the frame
  must be one of them, or the page cancels the intent and says why. This
  closes the case the handshake leaves: an unknown page framing the client
  app itself, around the composer.
- **The rest of the app** keeps `CSP_FRAME_ANCESTORS`: only `/intents` and
  `/intents/callback` are framed by any page. With a whole policy set by
  `CONTENT_SECURITY_POLICY`, the intents page gets it too (the image logs a
  warning): its `frame-ancestors` must let the client apps in.
- **The limit.** Firefox has no `location.ancestorOrigins`, and an older
  stack no `frameAncestors`: there, only the handshake guards the page, and
  a page framing the client app depends on the `frame-ancestors` of the
  client (Twake Chat sends `'none'`, `'self'` and Twake Space on `/embed/`).

## Platform configuration

- **Manifest** of the `mailng` app of the registry, the standalone Twake
  Mail the Workplace home opens: `manifest/manifest.webapp` of this
  repository, published on a `vX.Y.Z` tag (#318), declares the intent (#320):

  ```json
  "client_url_flag": "mailng.embedded-app-url",
  "service_url_flag": "mailng.embedded-app-url",
  "intents": [
    { "action": "CREATE", "type": ["io.cozy.mails"], "href": "/intents" }
  ]
  ```

- **Feature flag** `mailng.embedded-app-url`: the bare origin of Twake Mail
  (e.g. `https://mail.example.com`, no path), on the context or the
  instance. The home opens it (`standalone`, with
  `apps.enable-standalone-apps`) and the stack sends the intent there; the
  `mailng` app is installed on the instance. Without the flag the stack
  builds the address of the service on the subdomain of the app, which
  serves nothing.
- **OIDC client** of Twake Mail: add the redirect URI
  `https://<Twake Mail>/intents/callback` (with `/callback`). The SSO must
  answer a `prompt=none` request in the frame with a redirect only (a code,
  or `error=login_required`), never with a page of its own: a framed page of
  the SSO would be refused by its `frame-ancestors`, or show a form in the
  frame. LemonLDAP and Keycloak do; Dex keeps no session and cannot.
- **Token exchange**: `oidc.app_token_exchange` of the stack maps the OIDC
  client of Twake Mail to `registry://mailng`, the app whose manifest
  declares the intent: the stack lets only that app read the intent, and
  checks the origin of the exchange against `mailng.embedded-app-url`. The
  Drive picker and the platform bar of Twake Mail use the same token.
- **Permission on `io.cozy.mails`**: the `docs/intents.md` of cozy-stack says
  an app needs a permission on the doctype of the intents it serves. The
  stack does not check it today (`FindIntent` matches the action and the
  type only), so the `mailng` manifest asks for none; should the stack
  enforce it, the manifest would add one on `io.cozy.mails`.
- **cozy-stack** with linagora/cozy-stack#4965 (required): `service_url_flag`,
  `GET /intents/:id` for the OAuth client linked to the app, no
  `session_code` sent to an external service.
- **cozy-stack** with linagora/cozy-stack#4978 (optional): `frameAncestors`
  in the intent, for the check of the ancestors. Without it the page works
  the same, guarded by the handshake only.
- **Image of Twake Mail**: nothing for the frame (`/intents` is framed by
  any page); `CSP_CONNECT_SRC` allows the cozy-stack of the users
  (`https://*.example.com`).
- **Client app**: its `frame-src` allows the origin of Twake Mail, and its
  own manifest sets `client_url_flag`, whose flag holds its bare origin
  (e.g. `https://chat.example.com`): the stack tells the service this
  origin, the only one the service answers.

## Tests

Jest covers the page with the real composer on the fake JMAP server,
`cozy-interapp` mocked at the boundary (`IntentPage.spec.tsx`,
`IntentsApp.spec.tsx`), and the image smoke test the `frame-ancestors` of
`/intents`. No Playwright spec yet: the end-to-end stack signs in with Dex,
which keeps no SSO session, so the silent login of a frame cannot succeed
there. The framed path is checked on a Workplace once the `mailng`
manifest declaring the intent is published.
