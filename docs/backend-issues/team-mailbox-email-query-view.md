### Description of the bug

While setting up an e2e stack for Twake Mail on `linagora/tmail-backend:memory-1.0.21.2`, a team mailbox looked empty in the client: `Email/query` with `filter: {inMailbox}` and `sort: receivedAt desc` returned `ids: []`, while `Mailbox/get` reported `totalEmails > 0`. Investigation shows two distinct problems:

- **A (all mailboxes, configuration):** the memory application enables the Email/query view but never registers the listener that feeds it.
- **B (team mailboxes, code):** the `populateEmailQueryView` WebAdmin task ignores team mailboxes, so their view cannot be rebuilt.

#### A. Memory image: Email query view enabled but never populated

- `tmail-backend/apps/memory/src/main/conf/jmap.properties:36` sets `view.email.query.enabled=true` (upstream James memory-app keeps it commented).
- `tmail-backend/apps/memory/src/main/conf/listeners.xml` only contains `<executeGroupListeners>true</executeGroupListeners>`. It does not register `org.apache.james.jmap.event.PopulateEmailQueryViewListener`, which is only registered through `listeners.xml` (no Guice binding). #1156 and #1157 added it to the distributed and postgres default configurations, but not to memory. The memory integration tests' `listeners.xml` does register it.
- `EmailQueryViewOptimizer` (james-project `server/protocols/jmap-rfc-8621/.../method/EmailQueryOptimizer.scala:44-92`) answers `inMailbox`, `inMailbox+after` and `inMailbox+before` queries sorted by `receivedAt` desc from the view only, with no fallback to the search index.

Result: on the memory image with its default configuration (and in `demo/`, which mounts `jmap.properties` with `view.email.query.enabled=true` and a `listeners.xml` without the listener), **every** mailbox appears empty to Twake Mail web and tmail-flutter, which both list a folder with exactly `{inMailbox}` + `receivedAt desc` (and `{inMailbox, before}` for "load more").

#### B. `populateEmailQueryView` skips team mailboxes

`EmailQueryViewPopulator` (james-project `server/protocols/webadmin/webadmin-jmap/.../EmailQueryViewPopulator.java:127,177`) iterates `usersRepository` and `MailboxQuery.privateMailboxesBuilder(session)`. Team mailboxes belong to `team-mailbox@<domain>`, which is not a user, so they are never visited. TMail's own `KeywordEmailQueryViewPopulator` (`webadmin/webadmin-mailbox/.../KeywordEmailQueryViewPopulator.java:161,221-229`) already handles team mailboxes explicitly.

On any deployment using the view (for example Twake Workplace: `view.email.query.enabled=true` + listener), a listener outage, or enabling the view on existing data, leaves team mailbox history invisible to clients, with no way to rebuild it.

When the listener **is** registered, team mailboxes are correctly indexed: both delivery through `TMailMailboxAppender` (session `team-mailbox@domain`) and `Email/set` by a member populate the view, and members get the expected ids.

### Reproduction Steps

Self-contained script (docker compose + curl + jq). For each mode it starts a fresh memory TMail and:

1. Creates `example.com`, users `alice`, `bob`, `carol`, team mailbox `marketing` (alice manager, bob member) and team folder `Folder`.
2. `carol` sends 3 mails to `marketing@`, `alice@` and `bob@` (JMAP `EmailSubmission/set`, so through `TmailLocalDelivery`).
3. `bob` creates 3 mails in `marketing/Folder` with `Email/set`.
4. `alice` shares two personal folders with `bob` (`sharedWith`) and fills them (one by alice, one by bob).
5. Runs `Email/query` variants as alice and as bob, then the `populateEmailQueryView` task, then the main query again.

Modes: `default` (`view.email.query.enabled=true`, `listeners.xml` as shipped), `listener` (same + `PopulateEmailQueryViewListener`), `off` (`view.email.query.enabled=false`).

Core request (using `core`, `mail`, `urn:apache:james:params:jmap:mail:shares`):

```json
["Email/query", {"accountId": "…", "filter": {"inMailbox": "<mailboxId>"},
  "sort": [{"property": "receivedAt", "isAscending": false}]}, "c"]
```

<details>
<summary>repro.sh</summary>

REPRO_SCRIPT

</details>

### Expected result

3 ids for each mailbox (each one holds 3 emails).

**Actual** (excerpt; identical on `memory-1.0.21.2` and `memory-branch-master` built 2026-10-02):

| mailbox / user | request | default | listener | off |
|---|---|---|---|---|
| alice INBOX (personal) / alice | inMailbox + receivedAt desc | **0** | 3 | 3 |
| team INBOX / bob (member) | inMailbox + receivedAt desc | **0** | 3 | 3 |
| alice's shared folder / bob | inMailbox + receivedAt desc | **0** | 3 | 3 |
| team INBOX / bob | same, after `populateEmailQueryView` | **0** | 3 | – |
| alice INBOX / alice | same, after `populateEmailQueryView` | 3 | 3 | – |
| any mailbox | inMailbox without sort, or receivedAt asc, or sentAt desc | 3 | 3 | 3 |

`Mailbox/get` reports `totalEmails: 3` everywhere. `collapseThreads` true/false and the `after`/`before` variants behave like the main request.

### Context

- `linagora/tmail-backend:memory-1.0.21.2`, `linagora/tmail-backend:memory-branch-master` (2026-10-02)
- Default memory `jmap.properties` / `listeners.xml` (see above); Basic auth.
- Only the memory image was tested. Cassandra keys the view by mailboxId and Postgres creates its DAO per user domain, so no team-specific difference is expected for A or B there, but this was not verified.

### Additional information

**Suggested fixes**

1. Memory app: either comment `view.email.query.enabled=true` (as in James memory-app and the TMail distributed/postgres samples), or register `PopulateEmailQueryViewListener` in `apps/memory/src/main/conf/listeners.xml`. Same for `demo/tmail/listeners.xml`.
2. Make the `populateEmailQueryView` task cover team mailboxes, like `KeywordEmailQueryViewPopulator` already does (TMail-specific populator, or an extension point in James).
3. Optionally, log a warning at startup when `view.email.query.enabled=true` and `PopulateEmailQueryViewListener` is not registered.

**Workarounds**

- Register `PopulateEmailQueryViewListener` in `listeners.xml`. This is the intended setup, but it does not recover mails stored before it was enabled, and for team mailboxes there is no backfill (B).
- Or set `view.email.query.enabled=false`. Free on memory; on distributed, every folder listing then falls back to OpenSearch, which the view exists to avoid.

**Related:** #566 (closed, 2023: team mailbox empty in tmail-flutter on a Cassandra preprod, solved by an infrastructure config change), #1156, #1157.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
