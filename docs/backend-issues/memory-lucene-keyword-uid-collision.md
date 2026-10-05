### Description of the bug

On the **memory** image (Lucene search index), an `Email/query` filtered on a keyword **without `inMailbox`** (`hasKeyword`, `notKeyword`, also inside `AND` / `inMailboxOtherThan`) matches messages **by UID only**: a message of mailbox X is returned as soon as **another mailbox** holds a message **with the same UID** that has the keyword (or, for `notKeyword`, lacks it).

Typical symptom: the **Sent copy** of an email sent to oneself shows up in a label view (`hasKeyword: <label>`) although only the INBOX copy carries the label. Both copies are often the Nth message of their mailbox, hence share a UID. Same for the Starred view (`hasKeyword: $flagged`) and for `notKeyword` (an email that **has** the keyword is returned by `notKeyword`).

The repro sends nothing: emails are created with `Email/set`, one per call, in fresh accounts so that UIDs are known. Case B isolates the cause:

- INBOX `a2` (UID 2) has the keyword and the Message-ID header `<shared@example.com>`;
- Sent `s1` (UID **1**) has the **same Message-ID** header, no keyword → **not** returned;
- Sent `s2` (UID **2**) has another Message-ID, no keyword → **returned**.

So it is neither the Message-ID header nor a shared flags-document id (`createFlagsIdField` is `flags-<mailboxId>-<uid>`, unique per mailbox): it is the UID.

#### Cause (James upstream, line numbers at james-project `9aac85900f`, the TMail submodule; identical on apache/james-project `master` today)

Flags are not on the message document: each message has a separate "flags" document (`LuceneIndexableDocument.createFlagsDocument`, `mailbox/lucene/src/main/java/org/apache/james/mailbox/lucene/search/LuceneIndexableDocument.java:223-253`). A flag criterion is therefore resolved in two steps, in `LuceneMessageSearchIndex.createFlagQuery` (`mailbox/lucene/src/main/java/org/apache/james/mailbox/lucene/search/LuceneMessageSearchIndex.java:576-622`):

1. search the flags documents having (or, for "not set", not having) the flag in `inMailboxes`, i.e. **every mailbox of the query** (`buildQueryFromMailboxes`, :396-403: one `SHOULD` clause per mailbox), and collect **only their UIDs** into a `Set<MessageUid>` (:593-601);
2. turn those UIDs into ranges and return a **bare UID query** (`createUidQuery`, :612-618), with no mailbox in it.

`buildQuery` (:405-417) then ANDs that UID query with the same "any of the mailboxes" clause. With one mailbox (`inMailbox`) the result is right; with several mailboxes (no `inMailbox`, `inMailboxOtherThan`, which James resolves to the list of the user's mailboxes) any message of any of them whose UID is in the set matches. `notKeyword` takes the same path (:582-587), with the UIDs of the messages *lacking* the flag.

JMAP side, nothing specific: `MailboxFilter.HasKeyWord` / `NotKeyWord` (`server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/utils/search/MailboxFilter.scala:199-222`) map to `SearchQuery.flagIsSet` / `flagIsUnSet`, which Lucene receives as `FlagCriterion` / `CustomFlagCriterion` (`LuceneMessageSearchIndex.java:776-781`).

The two-step flag query is old James code; the memory app is backed by Lucene since JAMES-4077 (`ed88ea9e47`, 2024-11). Not TMail-specific: the TMail memory app gets Lucene from James' `MemoryMailboxModule`.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-memory-lucene-keyword-uid-collision`, `127.0.0.1:18460` JMAP, `127.0.0.1:18461` WebAdmin), with a mounted `jmap.properties` that switches to Basic auth (the image's JWT key files are missing) and sets `view.email.query.enabled=false`, so that `Email/query` is answered by the search index. Each case uses a **new** user (UIDs restart at 1 in each mailbox) and creates its emails with `Email/set`, one per call, then queries:

- A. INBOX `a1` (UID 1, keyword `label1`), Sent `s1` (UID 1, no keyword);
- B. INBOX `a1` (UID 1), `a2` (UID 2, keyword `label1`, Message-ID `<shared@example.com>`); Sent `s1` (UID 1, same Message-ID as `a2`), `s2` (UID 2);
- C. INBOX `a1` (UID 1, `$flagged`), Sent `s1` (UID 1), Archive `r1` (UID 1), `r2` (UID 2, `$flagged`).

Request of case A:

```json
["Email/query", {"accountId": "…", "filter": {"hasKeyword": "label1"}, "sort": [{"property": "receivedAt", "isAscending": false}]}, "0"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties, docker-compose.postgres.yaml</summary>

`repro.mjs`:

```js
// Repro: on the tmail-backend memory image (Lucene search index), an Email/query filtered on a
// keyword (hasKeyword / notKeyword) WITHOUT inMailbox matches messages by UID only: a message of
// mailbox X is returned as soon as a message with the same UID in another mailbox Y has (or, for
// notKeyword, lacks) the keyword. Typical symptom: the Sent copy of an email sent to oneself shows
// up in a label (or Starred) view, because both copies are the Nth message of their mailbox.
// No email is sent: every email is created with Email/set, one per call, so that uids are known.
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   COMPOSE=docker-compose.postgres.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-memory-lucene-keyword-uid-collision,
// JMAP 127.0.0.1:18460, WebAdmin 127.0.0.1:18461, email query view disabled so that Email/query is
// answered by the search index). Each case uses a NEW user (so uids restart at 1 in each mailbox):
//   A. INBOX a1 (uid 1, keyword "label1"), Sent s1 (uid 1, no keyword)
//        hasKeyword label1 / notKeyword label1, without and with inMailbox
//   B. INBOX a1 (uid 1, no keyword), a2 (uid 2, keyword "label1");
//      Sent s1 (uid 1, same Message-ID header as a2, no keyword), s2 (uid 2, no keyword)
//        hasKeyword label1 -> is s2 (same uid) or s1 (same Message-ID) returned?
//   C. INBOX a1 (uid 1, $flagged), Sent s1 (uid 1), Archive r1 (uid 1), r2 (uid 2, $flagged)
//        hasKeyword $flagged (the "Starred" view), notKeyword $flagged
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18460'
const W = process.env.WA ?? 'http://127.0.0.1:18461'
const PROJECT = 'tmailbug-memory-lucene-keyword-uid-collision'
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
  let mailboxes = (await call([['Mailbox/get', { accountId }, '0']]))[0][1].list
  if (!mailboxes.some(m => m.role === 'archive')) {
    await call([['Mailbox/set', { accountId, create: { ar: { name: 'Archive' } } }, '0']])
    mailboxes = (await call([['Mailbox/get', { accountId }, '0']]))[0][1].list
  }
  const byRole = r => mailboxes.find(m => m.role === r)?.id
  const archive = byRole('archive') ?? mailboxes.find(m => m.name === 'Archive').id
  return { user, accountId, call, inbox: byRole('inbox'), sent: byRole('sent'), archive }
}

const ids = {}
const name = id => Object.entries(ids).find(([, v]) => v === id)?.[0] ?? id

// One Email/set per email, so that the uids follow the creation order within each mailbox.
async function create(a, mailboxId, n, keywords = {}, messageId) {
  const [[, res]] = await a.call([['Email/set', { accountId: a.accountId, create: { [n]: {
    mailboxIds: { [mailboxId]: true }, keywords: { $seen: true, ...keywords }, subject: `Email ${n}`,
    from: [{ email: a.user }], to: [{ email: a.user }], ...(messageId ? { messageId: [messageId] } : {}),
    bodyValues: { t: { value: `body of ${n}` } }, textBody: [{ partId: 't', type: 'text/plain' }],
  } } }, '0']])
  if (!res.created?.[n]) throw new Error(`create failed: ${JSON.stringify(res.notCreated)}`)
  ids[n] = res.created[n].id
}

const out = []
const say = s => { console.log(s); out.push(s) }

async function q(a, filter, expected) {
  const [[, res]] = await a.call([['Email/query', { accountId: a.accountId, filter, sort: [{ property: 'receivedAt', isAscending: false }] }, '0']])
  const got = res.ids ? `[${res.ids.map(name).sort().join(',')}]` : JSON.stringify(res)
  const exp = `[${[...expected].sort().join(',')}]`
  const label = JSON.stringify(filter).replace(new RegExp(`"(${[a.inbox, a.sent, a.archive].join('|')})"`, 'g'), m => ({ [`"${a.inbox}"`]: 'INBOX', [`"${a.sent}"`]: 'Sent', [`"${a.archive}"`]: 'Archive' })[m])
  say(`  Email/query ${label}: ${got}  expected ${exp}  -> ${got === exp ? 'OK' : 'WRONG'}`)
}

async function keywordsOf(a) {
  const [[, got]] = await a.call([['Email/get', { accountId: a.accountId, ids: Object.values(ids), properties: ['keywords', 'mailboxIds', 'messageId'] }, '0']])
  const mbx = id => ({ [a.inbox]: 'INBOX', [a.sent]: 'Sent', [a.archive]: 'Archive' })[id] ?? id
  for (const e of got.list.sort((x, y) => name(x.id).localeCompare(name(y.id)))) {
    say(`    ${name(e.id)}: ${Object.keys(e.mailboxIds).map(mbx)} keywords=${Object.keys(e.keywords).filter(k => k !== '$seen').join(',') || '-'} messageId=${e.messageId}`)
  }
}

async function run() {
  {
    for (const k of Object.keys(ids)) delete ids[k]
    const a = await account('kw')
    say('A. INBOX a1 (uid 1, keyword label1), Sent s1 (uid 1, no keyword)')
    await create(a, a.inbox, 'a1', { label1: true })
    await create(a, a.sent, 's1')
    await sleep(500)
    say('  Email/get:'); await keywordsOf(a)
    await q(a, { hasKeyword: 'label1' }, ['a1'])
    await q(a, { notKeyword: 'label1' }, ['s1'])
    await q(a, { hasKeyword: 'label1', inMailbox: a.inbox }, ['a1'])
    await q(a, { hasKeyword: 'label1', inMailbox: a.sent }, [])
    await q(a, { notKeyword: 'label1', inMailbox: a.inbox }, [])
    await q(a, { hasKeyword: 'label1', inMailboxOtherThan: [a.archive] }, ['a1'])
    await q(a, { operator: 'AND', conditions: [{ hasKeyword: 'label1' }, { text: 'Email' }] }, ['a1'])
  }
  {
    for (const k of Object.keys(ids)) delete ids[k]
    const a = await account('kw')
    say('B. INBOX a1 (uid 1), a2 (uid 2, keyword label1, Message-ID <shared@example.com>); Sent s1 (uid 1, same Message-ID as a2), s2 (uid 2)')
    await create(a, a.inbox, 'a1')
    await create(a, a.inbox, 'a2', { label1: true }, 'shared@example.com')
    await create(a, a.sent, 's1', {}, 'shared@example.com')
    await create(a, a.sent, 's2')
    await sleep(500)
    say('  Email/get:'); await keywordsOf(a)
    await q(a, { hasKeyword: 'label1' }, ['a2'])
    await q(a, { notKeyword: 'label1' }, ['a1', 's1', 's2'])
  }
  {
    for (const k of Object.keys(ids)) delete ids[k]
    const a = await account('kw')
    say('C. INBOX a1 (uid 1, $flagged), Sent s1 (uid 1), Archive r1 (uid 1), r2 (uid 2, $flagged)')
    await create(a, a.inbox, 'a1', { $flagged: true })
    await create(a, a.sent, 's1')
    await create(a, a.archive, 'r1')
    await create(a, a.archive, 'r2', { $flagged: true })
    await sleep(500)
    say('  Email/get:'); await keywordsOf(a)
    await q(a, { hasKeyword: '$flagged' }, ['a1', 'r2'])
    await q(a, { notKeyword: '$flagged' }, ['s1', 'r1'])
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
# TMail memory backend (Lucene search index) for the hasKeyword / notKeyword without inMailbox repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing; the
# email query view is disabled, as in the Twake Mail web e2e stack, so that Email/query is
# always answered by the search index).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18460  JMAP
#   127.0.0.1:18461  WebAdmin
name: tmailbug-memory-lucene-keyword-uid-collision

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18460:80'
      - '127.0.0.1:18461:8000'
```
`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one switches to Basic auth and disables the email query view (as the
# Twake Mail web e2e stack does, see #2682): Email/query is then answered by the search index.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18460
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
name: tmailbug-memory-lucene-keyword-uid-collision

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
      - '127.0.0.1:18460:80'
      - '127.0.0.1:18461:8000'
```
</details>

### Expected result

RFC 8621 §4.4.1: `hasKeyword` — "This Email must have the given keyword to match the condition"; `notKeyword` — "This Email must not have the given keyword". A keyword filter is evaluated on each Email alone; the presence of the keyword on another message (of another mailbox) is irrelevant.

**Actual** (`Email/query` result; `Email/get` confirms the keywords listed in the "data" column):

| case | filter | expected | `memory-1.0.21.2` | `memory-branch-master` | `postgresql-1.0.21.2` (control) |
|---|---|---|---|---|---|
| A | `hasKeyword: label1` | a1 | **a1, s1** | **a1, s1** | a1 |
| A | `notKeyword: label1` | s1 | **a1, s1** | **a1, s1** | s1 |
| A | `hasKeyword: label1, inMailbox: INBOX` | a1 | a1 | a1 | a1 |
| A | `hasKeyword: label1, inMailbox: Sent` | (none) | (none) | (none) | (none) |
| A | `notKeyword: label1, inMailbox: INBOX` | (none) | (none) | (none) | (none) |
| A | `hasKeyword: label1, inMailboxOtherThan: [Archive]` | a1 | **a1, s1** | **a1, s1** | a1 |
| A | `AND [hasKeyword: label1, text: "Email"]` | a1 | **a1, s1** | **a1, s1** | a1 |
| B | `hasKeyword: label1` (s1 = same Message-ID, s2 = same UID) | a2 | **a2, s2** | **a2, s2** | a2 |
| B | `notKeyword: label1` | a1, s1, s2 | **a1, a2, s1, s2** | **a1, a2, s1, s2** | a1, s1, s2 |
| C | `hasKeyword: $flagged` (Starred) | a1, r2 | **a1, r1, r2, s1** | **a1, r1, r2, s1** | a1, r2 |
| C | `notKeyword: $flagged` | r1, s1 | **a1, r1, s1** | **a1, r1, s1** | r1, s1 |

Full outputs: `results-memory-1.0.21.2.txt`, `results-memory-branch-master.txt`, `results-postgresql-1.0.21.2.txt`.

### Context

- `linagora/tmail-backend:memory-1.0.21.2`, `linagora/tmail-backend:memory-branch-master` (built 2026-10-02). Control on `linagora/tmail-backend:postgresql-1.0.21.2` with `postgres:16` (`COMPOSE=docker-compose.postgres.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2`, which also mounts the memory image's test keystore). The postgresql image's search implementation is `scanning`: the control shows the expected behaviour, it does not exercise an index.
- Image configuration, except `jmap.properties` (Basic auth, `view.email.query.enabled=false`, as in the Twake Mail web e2e stack).
- Distributed image (OpenSearch) not tested: flags are fields of the message document there.

### Additional information

**Already reported, without a cause:** a comment of 2026-01-07 on #2039 shows this on `memory-1.0.13-rc5` and `memory-branch-master` (`hasKeyword: <label>` returning the untagged copies 22-24 of the tagged 19-21, plus older emails); the answer attributed it to "a similar pitfall than OpenSearch". #2039 itself is about the distributed (OpenSearch) staging platform. This issue gives the Lucene-specific cause.

**Suggested fix** (James, `LuceneMessageSearchIndex.createFlagQuery`): keep the mailbox of each flags document and return, instead of a bare UID query, one clause per mailbox:

```java
// collect (mailboxId -> uids) from the flags documents instead of a flat Set<MessageUid>
Map<String, List<MessageUid>> uidsByMailbox = ...; // doc.get(MAILBOX_ID_FIELD) -> uid
BooleanQuery.Builder perMailbox = new BooleanQuery.Builder();
uidsByMailbox.forEach((mailboxId, uids) -> perMailbox.add(new BooleanQuery.Builder()
        .add(new TermQuery(new Term(MAILBOX_ID_FIELD, mailboxId)), BooleanClause.Occur.MUST)
        .add(createUidQuery(rangesOf(uids)), BooleanClause.Occur.MUST)
        .build(), BooleanClause.Occur.SHOULD));
return perMailbox.build();
```

(mind that message documents store `MAILBOX_ID_FIELD` upper-cased, `LuceneIndexableDocument.java:133`, flags documents as is, :226: harmless for the numeric memory ids, but the clause should use the same form as the message documents). The `\RECENT` special case (:603-610) only makes sense per mailbox too. The structural fix would be to store the flags on the message document and `updateDocument` it by `ID_FIELD`, which removes the two-step query altogether. A `LuceneMessageSearchIndexTest` / `AbstractMessageSearchIndexTest` case "flag search across mailboxes having the same uids" would cover it.

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`): the label view (`LabelList.tsx`, `{hasKeyword: label.keyword}`) and the Starred view (`StarredList.tsx`, `{hasKeyword: $flagged}`) query without `inMailbox`. On the memory image (its e2e stack) they list emails that do not carry the label / star, e.g. the Sent copy of an email to oneself; documented in its handoff notes as a backend quirk.
- tmail-flutter: the Favorite and label "mailboxes" and the "action required" view (`lib/features/thread/presentation/filters/mailbox_filter_builder.dart`, `_buildKeywordBasedFilter`, `_buildActionRequiredMailboxFilter`) use `hasKeyword` / `notKeyword: $seen` without `inMailbox`: same wrong lists on the memory image. No client workaround short of one `Email/query` per mailbox.
- Any Lucene-based James deployment; IMAP `SEARCH` is per mailbox and not affected.

**Related:** #2039 (comment above), #2684 (other memory-image `Email/set` bug), #2682 (email query view, disabled in this repro), #2685, #2686, and the Lucene "expunge of consecutive UIDs empties the mailbox from the index" candidate (`createQuery(MessageRange)` without `RANGE` case), same class.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
