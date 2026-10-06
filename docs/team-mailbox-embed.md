# Facade of a team mailbox (TwakeSpace)

The Mail tab of a TwakeSpace space frames this app on the facade of the
space's team mailbox ([ADR 010][adr010] of twake-space-architecture: one
iframe contract for the Drive, Mail, Chat, Calendar and Tasks tabs).

## Route

```
/embed/team-mailboxes/<id>[/mailbox/<folder id>[/email/<email id>]]
```

- `<id>` is the id of the root folder of the team mailbox, the resource id
  the mail side service publishes in `com.twake.mail.space.provisioned.v1`
  ([ADR 005][adr005]). The service reads it from webadmin, the `mailboxId`
  of the folder named after the team mailbox in
  `GET /domains/<domain>/team-mailboxes/<name>/mailboxes`; JMAP gives every
  member the same id for that folder (`Mailbox/get`, namespace
  `TeamMailbox[<address>]`, no parent). It does not change when the space
  is renamed. The app never receives a space id.
- The facade is the list and the reading view of the team mailbox, opened
  on its Inbox: no top bar, sidebar (no folder tree), app grid, account
  menu, labels nor banners. "New message" is a floating button at every
  size, hidden while an email fills the screen. The other folders of the
  team mailbox open by their path (`/mailbox/<folder id>`).
- Two layouts only: the mobile one below 600 px, the desktop one from there
  (`WithoutTablets`). The frame is narrower than the screen of TwakeSpace:
  the tablet layouts of the webmail (the list beside the reading pane from
  900 px, compact rows) would show to desktop users.
- The routes live under the base `/embed/team-mailboxes/<id>` (the
  `basename` of their router): the screens of the webmail link inside it.
  Anything else, a folder of the user or of another team mailbox, leads to
  the Inbox of the team mailbox, never to the folders of the user.
- A user who is not a member of the team mailbox (a viewer of the space has
  no access, ADR 005), or an id that is not the root of a team mailbox of
  theirs, gets "This team mailbox is not available"
  (`team-mailbox-unavailable`).
- A new message writes from the identity of the team mailbox (its sent copy
  and its drafts go to its folders, as in the webmail). Moving an email to a
  folder of the user stays possible from the move picker.

## Sign in

The facade signs in as the webmail does (`AUTH_MODE`), with one difference
in a frame: the SSO refuses to show its portal there, and a frame cannot
tell a blocked page from a slow one. So, in a frame, the authorization
request is silent (`prompt=none`) and replaces the page (no entry in the
history the frame shares with TwakeSpace):

- with an SSO session (the one of TwakeSpace, same site), the SSO comes
  back with a code at once;
- without one, it comes back with `login_required` (or
  `interaction_required`, `consent_required`, `account_selection_required`):
  the facade shows "Your session has expired" (`team-mailbox-session-expired`)
  and tells TwakeSpace, which signs the user in again and reloads its frames.

LemonLDAP::NG must answer the silent request with a redirection (as for
Twake Tasks, ADR 009 of twake-space-architecture): the default `query`
response mode, and `jsRedirect` off, since a form post and a JavaScript
redirection are pages it refuses to show in a frame.

The callback page of the SSO (`/callback`, or `login-callback.html` with
`DOMAIN_REDIRECT_URL`) is outside the base of the facade: the app knows a
login of the facade by the return path of the pending login, handles the
callback first, then puts that path back in the address. Outside a frame
(the route opened in a tab) the login is the regular one.

## Talking to TwakeSpace

Raw `postMessage` (ADR 010 of twake-space-architecture), to the origin of
`TWAKE_SPACE_URL` only, and from it only (`event.origin` and
`event.source` are checked). Outside a frame or without `TWAKE_SPACE_URL`, the
facade says nothing. `resourceId` is the root id of the route, and `path` the
URL of the frame below `/embed/team-mailboxes/<rootId>` (pathname, query and
fragment): `''` on the route itself, otherwise it starts with `/`, `?` or `#`.

TwakeSpace owns the history of the page; the frame has no entries of its own:

- `history.pushState` is replaced by `history.replaceState`, and
  `history.replaceState` is wrapped, once, when the router starts. Each change
  of the URL, and the first one, is sent as
  `{ type: 'twake-embed:path', resourceId, path, replace }`: `replace` is
  `false` for what was a `pushState`, `true` otherwise.
- `{ type: 'twake-embed:navigate', resourceId, path }` (Back, Forward, deep
  link): the router navigates to `path` with a replace, without reporting the
  URL it writes. Dropped when `resourceId` is not the mailbox shown.
- `{ type: 'twake-embed:load', resourceId, path }` (another mailbox): the
  router cannot switch mailbox in place yet (its base is read once), so the
  facade does `location.replace` to the route of `resourceId` plus `path`.
- the facade never navigates its own document after its boot.
- **sign in again**: `notifyLoginRequired()` of cozy-external-bridge. Until a
  version of it has it, the facade posts `{ type: 'twake-embed:login-required' }`.

### Overlay

The composer and the dialogs of the facade show on the page of TwakeSpace,
not inside the frame: the composer at the bottom end of its window, a dialog
centred on it and dimming all of it.

- TwakeSpace names the frame of the facade and puts a second frame over its
  whole page, named after the first (`<frame name>:overlay`), on
  `/embed/overlay.html`, an empty page that boots nothing.
- The facade finds the overlay by its name once loaded (it has the same
  origin; after 5 s without it, it renders in its frame), copies
  its CSS rules into it, and renders there with React portals: the
  `WindowDock` of the composer, and every `Dialog` and temporary `Drawer`
  through the theme (`ds/SpaceOverlay`). Menus and tooltips follow the
  document of their anchor.
- Each time what it draws changes, the facade sends TwakeSpace the region of
  the overlay to show, from its own frame
  (`{ type: 'twake-embed:overlay-region', region }`): the boxes of its windows, or
  the whole page while a dialog, a menu or a full screen window is open. It
  posts it to any origin, so the overlay needs no `TWAKE_SPACE_URL`: the
  region is only boxes of the layout, and `frame-ancestors` says who may
  frame the facade.
  TwakeSpace clips the overlay to it, so the rest of its page keeps its
  clicks. The region is computed on a timer, not on the animation frames of
  the overlay: the browser does not run them while the overlay shows nothing.
- Without the overlay (outside a frame, an older TwakeSpace that does not
  name the frame), the composer and the dialogs stay in the frame, as in the
  webmail.

## Deployment

- Team mailboxes need the ACLs of James: `acl.enabled=true` in
  `cassandra.properties` (`mailRepository.cassandra.aclEnabled` in the Helm
  chart of tmail-backend).
- `TWAKE_SPACE_URL`: the URL of TwakeSpace (its origin is kept).
- `CSP_FRAME_ANCESTORS` must allow the origin of TwakeSpace. The header is
  the same for every page: the SSO callback is framed too.
- TwakeSpace, the app and the SSO portal are served on one registrable
  domain (ADR 010), so that the SSO cookie reaches the frame.

[adr010]: https://github.com/linagora/twake-space-architecture/pull/10
[adr005]: https://github.com/linagora/twake-space-architecture/pull/5
