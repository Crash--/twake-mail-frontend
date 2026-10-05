### Description of the bug

On the **memory** image (Lucene search index), expunging **two or more messages with consecutive UIDs** from a mailbox in one operation removes **every message of that mailbox** from the search index. The messages are still there (`Email/get`, `Mailbox/get` `totalEmails`, `Email/changes`), but `Email/query` `{inMailbox}` no longer returns them, sorted or not, until the index is rebuilt. Messages added afterwards are indexed normally, so the mailbox looks like it only holds the new ones.

Any client operation that expunges a contiguous block triggers it:

- `Email/set` `destroy` of 2+ emails whose UIDs are consecutive (select two adjacent drafts → Delete forever; empty a selection in Trash);
- IMAP `UID STORE 2:3 +FLAGS (\Deleted)` + `EXPUNGE`;
- anything else that publishes one `Expunged` event with consecutive UIDs (mailbox clear, cleanup tasks, etc.).

`Email/set` update moves are **not** affected today on memory, because the JMAP move path expunges the source mailbox message by message (case D below).

There is no workaround on the TMail memory image: it does not wire James' `ReIndexingModule`, so `POST /mailboxes/{id}?task=reIndex` answers 404 (case G).

#### Cause (James upstream, line numbers at james-project `9aac85900f`, the TMail submodule; identical on apache/james-project `master` today)

- `mailbox/store/src/main/java/org/apache/james/mailbox/store/search/ListeningMessageSearchIndex.java:122-125`: an `Expunged` event calls `delete(session, mailboxId, expunged.getUids())`.
- `mailbox/lucene/src/main/java/org/apache/james/mailbox/lucene/search/LuceneMessageSearchIndex.java:843-848`: `delete(session, mailboxId, uids)` turns the UIDs into ranges with `MessageRange.toRanges(uids)` and calls `delete(mailboxId, range)` for each.
- `mailbox/api/src/main/java/org/apache/james/mailbox/model/MessageRange.java:153-188` (`toRanges`) and `:76-85` (`range`): consecutive UIDs become a single `MessageRange` of type **`RANGE`** (`{2, 3}` → `RANGE 2:3`); isolated UIDs become `ONE`.
- `LuceneMessageSearchIndex.java:831-841`, `createQuery(MessageRange)`:

  ```java
  return switch (range.getType()) {
      case ONE -> LongPoint.newRangeQuery(UID_FIELD, range.getUidFrom().asLong(), range.getUidTo().asLong());
      case FROM -> LongPoint.newRangeQuery(UID_FIELD, range.getUidFrom().asLong(), MessageUid.MAX_VALUE.asLong());
      default -> LongPoint.newRangeQuery(UID_FIELD, MessageUid.MIN_VALUE.asLong(), MessageUid.MAX_VALUE.asLong());
  };
  ```

  `RANGE` has no case and falls into `default`, which is the query for `ALL`. `delete(mailboxId, range)` (lines 855-861) then runs `writer.deleteDocuments(mailboxId AND uid in [MIN, MAX])`: every document of the mailbox.

So the bug is in James' Lucene index, not in TMail nor in the JMAP layer. It affects every James server using `LuceneMessageSearchIndex` (James memory app, TMail memory image, Lucene-based deployments), not the OpenSearch/scanning ones. The same `createQuery` was already there before the Lucene changes of October-November 2024 (JAMES-3858, JAMES-4082).

Not the same cause as #2684 (`InMemoryMessageIdMapper.findMetadata`) nor #2682 (email query view): the repro disables the view and only destroys emails.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-memory-lucene-expunge-range`, `127.0.0.1:18426` JMAP, `127.0.0.1:18427` WebAdmin, `127.0.0.1:18432` IMAPS), with a mounted `jmap.properties` that switches to Basic auth (the image's JWT key files are missing) and sets `view.email.query.enabled=false`, so that `Email/query` is answered by the search index (with the image default `true`, an `inMailbox` query sorted by `receivedAt` desc goes to the email query view, which is empty on memory, see #2682).

For each case a **new** user creates 5 drafts d1…d5 in Drafts, **one `Email/set` per email** so that d1…d5 get UIDs 1…5 (creations within a single `Email/set` run concurrently and get their UIDs in any order), plus 2 emails in INBOX. Then one operation, and the script compares `Email/query {inMailbox: Drafts}` (unsorted and sorted by `receivedAt` desc) with `Email/get` and `Mailbox/get`.

Request of case A:

```json
["Email/set", {"accountId": "…", "destroy": ["<d2>", "<d3>"]}, "0"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties, docker-compose.postgres.yaml</summary>

`repro.mjs`:

```js
// Repro: on the tmail-backend memory image (Lucene search index), expunging two or more
// messages with CONSECUTIVE uids from a mailbox removes EVERY message of that mailbox from the
// search index. The messages are still there (Email/get, Mailbox/get counts), but Email/query
// no longer returns them, until a WebAdmin reindex.
// Triggered by: Email/set destroy of 2 emails, Email/set update moving 2 emails away.
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   COMPOSE=docker-compose.postgres.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-memory-lucene-expunge-range,
// JMAP 127.0.0.1:18426, WebAdmin 127.0.0.1:18427, email query view disabled so that Email/query
// is answered by the search index). Each case uses a NEW user that creates 5 drafts d1..d5 in
// Drafts (consecutive uids 1..5) and 2 emails in INBOX, then:
//   A. Email/set destroy [d2, d3]           (uids 2-3: consecutive)
//   B. Email/set destroy [d2, d4]           (uids 2 and 4: control)
//   C. Email/set destroy [d2], then [d3]    (two calls: control)
//   D. Email/set update  d2, d3 -> Trash    (move: expunge of uids 2-3 from Drafts)
//   E. Email/set destroy [d2, d3, d4]       (3 consecutive uids)
//   H. IMAP (993): UID STORE 2:3 +FLAGS (\Deleted), EXPUNGE in Drafts
// and checks Email/query {inMailbox: Drafts} (unsorted and sorted by receivedAt desc),
// Email/get of the kept drafts, Mailbox/get totalEmails, Email/query on INBOX.
// Then: a new draft created after A is found, and a WebAdmin reindex brings the others back.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { connect as tlsConnect } from 'node:tls'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18426'
const W = process.env.WA ?? 'http://127.0.0.1:18427'
const IMAPS_PORT = Number(process.env.IMAPS_PORT ?? 18432)
const PROJECT = 'tmailbug-memory-lucene-expunge-range'
const USING = ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail']
const D = 'example.com'

const sh = (cmd, env = {}) => execSync(cmd, { cwd: DIR, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).toString()
const compose = (image, args) => sh(`docker compose -p ${PROJECT} -f ${process.env.COMPOSE ?? 'docker-compose.yaml'} ${args}`, { TMAIL_IMAGE: image })
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function startStack(image) {
  compose(image, 'down -v --remove-orphans')
  compose(image, 'up -d')
  for (let i = 0; i < 90; i += 1) {
    try { if ((await fetch(`${W}/domains`)).ok) return } catch {}
    await sleep(2000)
  }
  throw new Error(`${image} did not start`)
}

async function wa(method, path, body) {
  const r = await fetch(`${W}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
  if (!r.ok) throw new Error(`WebAdmin ${method} ${path} -> ${r.status} ${await r.text()}`)
  return r
}

let userSeq = 0
async function account(name = 'user') {
  const user = `${name}${(userSeq += 1)}@${D}`
  await wa('PUT', `/users/${user}`, { password: 'secret' })
  const headers = { Authorization: 'Basic ' + Buffer.from(`${user}:secret`).toString('base64'), 'Content-Type': 'application/json', Accept: 'application/json' }
  const session = await (await fetch(`${J}/jmap/session`, { headers })).json()
  const accountId = session.primaryAccounts['urn:ietf:params:jmap:mail']
  const call = async methodCalls => {
    const r = await fetch(`${J}/jmap`, { method: 'POST', headers, body: JSON.stringify({ using: USING, methodCalls }), signal: AbortSignal.timeout(30_000) })
    return (await r.json()).methodResponses
  }
  const mailboxes = (await call([['Mailbox/get', { accountId }, '0']]))[0][1].list
  const role = r => mailboxes.find(m => m.role === r).id
  return { user, accountId, call, drafts: role('drafts'), inbox: role('inbox'), trash: role('trash') }
}

// One Email/set per email, so that the uids follow the order of the names (d1 = uid 1, ...).
// The creations of a single Email/set run concurrently and get their uids in any order.
async function create(a, mailboxId, names) {
  const ids = {}
  for (const n of names) {
    const [[, res]] = await a.call([['Email/set', { accountId: a.accountId, create: { [n]: {
      mailboxIds: { [mailboxId]: true }, keywords: { $draft: true, $seen: true }, subject: n, from: [{ email: a.user }],
      bodyValues: { t: { value: n } }, textBody: [{ partId: 't', type: 'text/plain' }],
    } } }, '0']])
    if (!res.created?.[n]) throw new Error(`create failed: ${JSON.stringify(res.notCreated)}`)
    ids[n] = res.created[n].id
  }
  return ids
}

const out = []
const say = s => { console.log(s); out.push(s) }

// Names of the emails Email/query returns for a mailbox, in both query shapes the clients use.
async function query(a, mailboxId, ids) {
  const name = id => Object.entries(ids).find(([, v]) => v === id)?.[0] ?? id
  const [[, q1], [, q2]] = await a.call([
    ['Email/query', { accountId: a.accountId, filter: { inMailbox: mailboxId } }, 'q1'],
    ['Email/query', { accountId: a.accountId, filter: { inMailbox: mailboxId }, sort: [{ property: 'receivedAt', isAscending: false }] }, 'q2'],
  ])
  const fmt = q => (q.ids ? `[${q.ids.map(name).sort().join(',')}]` : JSON.stringify(q))
  return { unsorted: fmt(q1), sorted: fmt(q2) }
}

async function state(a, ids, kept) {
  const [[, got], [, mbx]] = await a.call([
    ['Email/get', { accountId: a.accountId, ids: kept.map(n => ids[n]), properties: ['subject', 'mailboxIds'] }, 'g'],
    ['Mailbox/get', { accountId: a.accountId, ids: [a.drafts, a.inbox], properties: ['totalEmails'] }, 'm'],
  ])
  const total = id => mbx.list.find(m => m.id === id).totalEmails
  const inDrafts = got.list.filter(e => e.mailboxIds[a.drafts]).map(e => e.subject).sort()
  const dq = await query(a, a.drafts, ids)
  const iq = await query(a, a.inbox, ids)
  const expected = `[${[...kept].sort().join(',')}]`
  say(`  expected in Drafts: ${expected}`)
  say(`  Email/get (kept drafts): ${inDrafts.length} found [${inDrafts.join(',')}]; Mailbox/get Drafts totalEmails=${total(a.drafts)}`)
  say(`  Email/query inMailbox Drafts: unsorted ${dq.unsorted}, sorted by receivedAt desc ${dq.sorted}  -> ${dq.unsorted === expected && dq.sorted === expected ? 'OK' : 'WRONG'}`)
  say(`  Email/query inMailbox INBOX (untouched, expect [i1,i2]): unsorted ${iq.unsorted}, sorted ${iq.sorted}`)
  return dq.unsorted === expected
}

async function scenario(label, act, kept) {
  const a = await account('lucene')
  const ids = { ...(await create(a, a.drafts, ['d1', 'd2', 'd3', 'd4', 'd5'])), ...(await create(a, a.inbox, ['i1', 'i2'])) }
  say(label)
  const before = await query(a, a.drafts, ids)
  say(`  before: Email/query inMailbox Drafts ${before.unsorted}`)
  await act(a, ids)
  await sleep(500)
  return { a, ids, ok: await state(a, ids, kept) }
}

const destroy = names => async (a, ids) => {
  const [[, res]] = await a.call([['Email/set', { accountId: a.accountId, destroy: names.map(n => ids[n]) }, '0']])
  say(`  Email/set destroy [${names}]: destroyed ${res.destroyed?.length ?? 0}, notDestroyed ${JSON.stringify(res.notDestroyed ?? null)}`)
}

// Minimal IMAP client over TLS: sends a command, resolves with the lines up to its tagged reply.
async function imap(user) {
  const socket = tlsConnect({ host: '127.0.0.1', port: IMAPS_PORT, rejectUnauthorized: false })
  let buffer = ''
  let waiter = null
  socket.on('data', d => { buffer += d.toString(); waiter?.() })
  const until = re => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`IMAP timeout waiting for ${re}`)), 15_000)
    waiter = () => { const m = buffer.match(re); if (m) { clearTimeout(timer); const text = buffer.slice(0, m.index + m[0].length); buffer = buffer.slice(m.index + m[0].length); waiter = null; resolve(text) } }
    waiter()
  })
  await until(/\* OK[^\r]*\r\n/)
  let n = 0
  const cmd = async c => { const tag = `t${(n += 1)}`; socket.write(`${tag} ${c}\r\n`); return (await until(new RegExp(`${tag} (OK|NO|BAD)[^\\r]*\\r\\n`))).trim() }
  await cmd(`LOGIN ${user} secret`)
  return { cmd, close: () => socket.end() }
}

async function run() {
  const A = await scenario('A. Email/set destroy [d2, d3] (consecutive uids 2-3)', destroy(['d2', 'd3']), ['d1', 'd4', 'd5'])
  await scenario('B. control: Email/set destroy [d2, d4] (uids 2 and 4)', destroy(['d2', 'd4']), ['d1', 'd3', 'd5'])
  await scenario('C. control: Email/set destroy [d2], then destroy [d3] (two calls)', async (a, ids) => {
    await destroy(['d2'])(a, ids)
    await destroy(['d3'])(a, ids)
  }, ['d1', 'd4', 'd5'])
  await scenario('D. Email/set update: move d2, d3 to Trash (expunge of uids 2-3 from Drafts)', async (a, ids) => {
    const [[, res]] = await a.call([['Email/set', { accountId: a.accountId, update: { [ids.d2]: { mailboxIds: { [a.trash]: true } }, [ids.d3]: { mailboxIds: { [a.trash]: true } } } }, '0']])
    say(`  Email/set update (move): updated ${Object.keys(res.updated ?? {}).length}, notUpdated ${JSON.stringify(res.notUpdated ?? null)}`)
  }, ['d1', 'd4', 'd5'])
  await scenario('E. Email/set destroy [d2, d3, d4] (consecutive uids 2-4)', destroy(['d2', 'd3', 'd4']), ['d1', 'd5'])
  if (!process.env.NO_IMAP) {
    await scenario('H. IMAP: SELECT Drafts, UID STORE 2:3 +FLAGS.SILENT (\\Deleted), EXPUNGE', async a => {
      const c = await imap(a.user)
      const last = r => r.split('\r\n').at(-1)
      say(`  ${last(await c.cmd('SELECT Drafts'))} | ${last(await c.cmd('UID STORE 2:3 +FLAGS.SILENT (\\Deleted)'))} | EXPUNGE: ${(await c.cmd('EXPUNGE')).replace(/\r\n/g, ' ')}`)
      await c.cmd('LOGOUT').catch(() => {})
      c.close()
    }, ['d1', 'd4', 'd5'])
  }

  say('F. after A: a new draft d6 is created in the same Drafts')
  Object.assign(A.ids, await create(A.a, A.a.drafts, ['d6']))
  await sleep(500)
  say(`  Email/query inMailbox Drafts: ${(await query(A.a, A.a.drafts, A.ids)).unsorted}  (expected [d1,d4,d5,d6])`)

  if (!process.env.NO_REINDEX) {
    const route = `/mailboxes/${A.a.drafts}?task=reIndex`
    say(`G. after A and F: WebAdmin POST ${route.replace(A.a.drafts, '<Drafts id>')}, then GET /tasks/<id>/await`)
    try {
      const { taskId } = await (await wa('POST', route)).json()
      const task = await (await wa('GET', `/tasks/${taskId}/await?timeout=60s`)).json()
      say(`  reindex task: ${task.status}`)
      await sleep(500)
      say(`  Email/query inMailbox Drafts: ${(await query(A.a, A.a.drafts, A.ids)).unsorted}  (expected [d1,d4,d5,d6])`)
    } catch (e) {
      say(`  reindex failed: ${e.message}`)
    }
  }
}

const images = process.argv.slice(2).length ? process.argv.slice(2) : ['linagora/tmail-backend:memory-1.0.21.2', 'linagora/tmail-backend:memory-branch-master']
for (const image of images) {
  out.length = 0
  if (!process.env.NO_STACK) await startStack(image)
  try {
    await wa('PUT', `/domains/${D}`)
    say(`image ${image}`)
    await run()
  } finally {
    writeFileSync(`${DIR}/results-${image.split(':').pop()}.txt`, out.join('\n') + '\n')
    if (!process.env.NO_STACK && !process.env.KEEP) compose(image, 'down -v')
  }
}
```
`docker-compose.yaml`:

```yaml
# TMail memory backend for the Lucene expunge-range repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing; the
# email query view is disabled, as in the Twake Mail web e2e stack, so that Email/query is
# always answered by the search index).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18426  JMAP
#   127.0.0.1:18427  WebAdmin
#   127.0.0.1:18432  IMAPS (case H)
name: tmailbug-memory-lucene-expunge-range

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18426:80'
      - '127.0.0.1:18427:8000'
      - '127.0.0.1:18432:993'
```
`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one switches to Basic auth and disables the email query view (as the
# Twake Mail web e2e stack does, see #2682): Email/query is then answered by the search index.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18426
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=false
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```
`docker-compose.postgres.yaml`:

```yaml
# Control run on the postgresql flavour (same ports, same jmap.properties). Its search
# implementation is "scanning" (sample-configuration/search.properties): no index at all.
# The postgresql image ships no /root/conf/keystore: reuse the memory image's test keystore:
#   docker run --rm --entrypoint cat linagora/tmail-backend:memory-1.0.21.2 /root/conf/keystore > keystore
#   COMPOSE=docker-compose.postgres.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2
name: tmailbug-memory-lucene-expunge-range

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: postgres
      POSTGRES_USER: tmail
      POSTGRES_PASSWORD: secret1
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U tmail']
      interval: 2s
      retries: 30
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:postgresql-1.0.21.2}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
      - ./keystore:/root/conf/keystore:ro
    ports:
      - '127.0.0.1:18426:80'
      - '127.0.0.1:18427:8000'
      - '127.0.0.1:18432:993'
```
</details>

### Expected result

`Email/query {inMailbox: Drafts}` returns the drafts that are still in Drafts (the ones `Email/get` and `Mailbox/get` see): only the expunged messages leave the index.

**Actual** (`Email/query {inMailbox: Drafts}` after the operation; `Email/get` and `totalEmails` are right in every case):

| case | expected | `memory-1.0.21.2` | `memory-branch-master` | `postgresql-1.0.21.2` (control) |
|---|---|---|---|---|
| A. `Email/set destroy [d2, d3]` (UIDs 2-3) | d1, d4, d5 | **empty** | **empty** | d1, d4, d5 |
| B. control: `destroy [d2, d4]` (UIDs 2 and 4) | d1, d3, d5 | d1, d3, d5 | d1, d3, d5 | d1, d3, d5 |
| C. control: `destroy [d2]`, then `destroy [d3]` | d1, d4, d5 | d1, d4, d5 | d1, d4, d5 | d1, d4, d5 |
| D. `Email/set update` d2, d3 → Trash | d1, d4, d5 | d1, d4, d5 | d1, d4, d5 | d1, d4, d5 |
| E. `destroy [d2, d3, d4]` (UIDs 2-4) | d1, d5 | **empty** | **empty** | d1, d5 |
| H. IMAP `UID STORE 2:3 +FLAGS.SILENT (\Deleted)`, `EXPUNGE` | d1, d4, d5 | **empty** | **empty** | d1, d4, d5 |
| F. after A, create d6 | d1, d4, d5, d6 | **d6 only** | **d6 only** | d1, d4, d5, d6 |
| G. after F, `POST /mailboxes/{id}?task=reIndex` | – | 404, route not wired | 404 | not run |
| INBOX of every case (untouched) | i1, i2 | i1, i2 | i1, i2 | i1, i2 |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (2026-09-30), `linagora/tmail-backend:memory-branch-master` (built 2026-10-02). Control on `linagora/tmail-backend:postgresql-1.0.21.2` with `postgres:16` (`COMPOSE=docker-compose.postgres.yaml NO_REINDEX=1 node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2`, which also mounts the memory image's test keystore). Note that the postgresql image's search implementation is `scanning` (`apps/postgres/sample-configuration/search.properties`): the control shows the expected behaviour, it does not exercise an index.
- Image configuration, except `jmap.properties` (Basic auth, `view.email.query.enabled=false`, as in the Twake Mail web e2e stack).
- Distributed image not tested (OpenSearch: `OpenSearchListeningMessageSearchIndex.delete` deletes by document id, not by range).

### Additional information

**Suggested fix** (James, `LuceneMessageSearchIndex.createQuery(MessageRange)`):

```java
return switch (range.getType()) {
    case ONE, RANGE -> LongPoint.newRangeQuery(UID_FIELD, range.getUidFrom().asLong(), range.getUidTo().asLong());
    case FROM -> LongPoint.newRangeQuery(UID_FIELD, range.getUidFrom().asLong(), MessageUid.MAX_VALUE.asLong());
    case ALL -> LongPoint.newRangeQuery(UID_FIELD, MessageUid.MIN_VALUE.asLong(), MessageUid.MAX_VALUE.asLong());
};
```

(an exhaustive switch without `default`, so that the compiler catches a future type). A `ListeningMessageSearchIndexContract` / `LuceneMessageSearchIndexTest` case "expunging two consecutive uids keeps the other messages searchable" would cover it.

TMail: consider wiring `ReIndexingModule` in the memory app (`MemoryServer`), so that an index problem on a demo or e2e stack can be fixed without a restart that loses all data.

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`): its e2e stack runs the memory image. Its spec `INFRA-17` (`e2e/tests/backend.spec.ts`) documents this behaviour, and the composer (`CMP-37`) reads the drafts with `Email/changes` instead of `Email/query` to avoid it. `INFRA-17` creates its 3 drafts in a single `Email/set` and relies on the two destroyed ones having consecutive UIDs; the UIDs of the creations of one `Email/set` do not always follow the order of the `create` map (with 5 creations they did not, in this repro), so that spec could flake on this condition. Any user action that destroys a selection (Delete forever, Empty Trash on part of a folder) empties the folder's list on the memory image.
- tmail-flutter: same on the memory image (mailbox list built from `Email/query`), e.g. after "Delete permanently" of several adjacent emails, or after an IMAP client expunges.
- Production deployments with OpenSearch (distributed) or scanning (postgresql) are not affected as far as tested. Lucene-based James deployments are.

**Related:** #2684 (other memory-image `Email/set` bug, different cause), #2682 (email query view on the memory image, disabled in this repro), #2685, #2686 (other issues found while building the Twake Mail web e2e suite).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
