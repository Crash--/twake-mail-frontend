### Description of the bug

On the **memory** image (Lucene search index), `SearchSnippet/get` fails or returns wrong data in three situations, all in James' `LuceneSearchHighlighter`:

1. **`serverFail` (`NullPointerException`)** as soon as one of the requested emails matches the filter through something else than its body (subject, from, …), its body does not contain the searched text, and it has a **text attachment** (indexed attachment content) that does not contain it either. One such email among the results fails the **whole** `SearchSnippet/get` (case E). The matching `Email/query` works.
2. **`serverFail` (`ParseException`)** when the `subject` / `text` value contains Lucene query-parser syntax: `[Ticket]`, an unbalanced `(`… The matching `Email/query` works.
3. **Wrong list** when a requested email sits in **two mailboxes**: its snippet comes back twice and another requested email is reported in `notFound`, although `Email/query` just returned it.

#### Cause (James upstream, `mailbox/lucene/src/main/java/org/apache/james/mailbox/lucene/search/LuceneSearchHighlighter.java`, line numbers at james-project `9aac85900f`, the TMail submodule; identical on apache/james-project `master` today)

1. `getHighlightAttachmentTextBody` (:188-194):

   ```java
   return Stream.ofNullable(doc.getFields(ATTACHMENT_TEXT_CONTENT_FIELD)).flatMap(Arrays::stream)
       .map(IndexableField::stringValue)
       .map(Throwing.function(contentType -> highlighter.getBestFragment(analyzer, ATTACHMENT_TEXT_CONTENT_FIELD, contentType)))
       .findFirst();
   ```

   `Highlighter.getBestFragment` returns `null` when the text has no matching term; `Stream.findFirst()` throws a `NullPointerException` when the element it selects is `null`. It is only reached when the body highlight is `null` (`buildSearchSnippet`, :167-174, `Optional.ofNullable(getHighlightedBody(…)).or(() -> getHighlightAttachmentTextBody(…))`). Server log:

   ```
   java.lang.NullPointerException
       at java.base/java.util.Objects.requireNonNull(Unknown Source)
       at java.base/java.util.Optional.of(Unknown Source)
       at java.base/java.util.stream.FindOps$FindSink$OfRef.get(Unknown Source)
       …
       at java.base/java.util.stream.ReferencePipeline.findFirst(Unknown Source)
       at org.apache.james.mailbox.lucene.search.LuceneSearchHighlighter.getHighlightAttachmentTextBody(LuceneSearchHighlighter.java:193)
       at org.apache.james.mailbox.lucene.search.LuceneSearchHighlighter.lambda$buildSearchSnippet$0(LuceneSearchHighlighter.java:171)
       at java.base/java.util.Optional.or(Unknown Source)
       at org.apache.james.mailbox.lucene.search.LuceneSearchHighlighter.buildSearchSnippet(LuceneSearchHighlighter.java:171)
   ```

   JAMES-4077 (`8ef825c6a5`, 2024-11-27, "LuceneSearchHighlighter - Fix NullpointerException") made the subject and body highlights null-safe, not this one.
2. `buildQuery` (:162-165) feeds the raw (lower-cased) value to the classic `QueryParser`: `[ticket]` is read as an unterminated range, `down (urgent` as an unclosed group, and the `ParseException` becomes a `serverFail`. The search itself (`LuceneMessageSearchIndex`) builds `PrefixQuery`s without parsing, so `Email/query` is fine.
3. `highlightSearch` (:118-124) asks `LuceneMessageSearchIndex.searchDocument` for `limit = messageIds.size()` **documents**, then keeps those whose message id is requested. `SearchSnippetGetMethod` already ANDs the requested ids into the query (`server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/method/SearchSnippetGetMethod.scala:96-99`), so the limit is only hit when a message has **one document per mailbox**: with `m1` in INBOX (UID 1) and Archive (UID 1) and `m2` in INBOX (UID 2), the 2 documents sorted by UID are both `m1`'s; `m2` is cut, `m1` is returned twice, and `SearchSnippetGetResponse` lists `m2` in `notFound`. (Asking snippets for 2 of 5 matching single-mailbox emails does not trigger it, thanks to that id criterion.)

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-memory-lucene-search-snippet-npe`, `127.0.0.1:18464` JMAP, `127.0.0.1:18465` WebAdmin), with a mounted `jmap.properties` that switches to Basic auth (the image's JWT key files are missing) and sets `view.email.query.enabled=false`. Each case uses a **new** user, uploads raw RFC 5322 messages and `Email/import`s them into INBOX (nothing is sent), then runs in one request `Email/query {filter}` and `SearchSnippet/get {filter, #emailIds}`; at the end it greps the server log for the `NullPointerException`.

Request of case A (`m1`: subject "Quarterly report", text/plain body "Hello there", text/plain attachment `notes.txt` "numbers inside"):

```json
[["Email/query", {"accountId": "…", "filter": {"subject": "Quarterly"}}, "q"],
 ["SearchSnippet/get", {"accountId": "…", "filter": {"subject": "Quarterly"},
   "#emailIds": {"resultOf": "q", "name": "Email/query", "path": "/ids"}}, "s"]]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties, docker-compose.postgres.yaml</summary>

`repro.mjs`:

```js
// Repro: on the tmail-backend memory image (Lucene search index), SearchSnippet/get answers
// serverFail (NullPointerException in LuceneSearchHighlighter.getHighlightAttachmentTextBody)
// as soon as one of the requested emails matches the filter through its subject (or any
// non-body field) while its body does not contain the searched word and it has a text
// attachment that does not contain it either. The matching Email/query works.
// Also checked, same class: a search value with Lucene query syntax characters ("[Ticket]",
// "down)"), and an email that sits in two mailboxes.
// No email is sent: the emails are uploaded as raw RFC 5322 messages and Email/import-ed.
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   COMPOSE=docker-compose.postgres.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-memory-lucene-search-snippet-npe,
// JMAP 127.0.0.1:18464, WebAdmin 127.0.0.1:18465, email query view disabled), then for each case a
// NEW user imports the case's emails in INBOX and runs, in one request:
//   Email/query {filter} and SearchSnippet/get {filter, #emailIds: result of the query}
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18464'
const W = process.env.WA ?? 'http://127.0.0.1:18465'
const PROJECT = 'tmailbug-memory-lucene-search-snippet-npe'
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
async function account() {
  const user = `snippet${(userSeq += 1)}@${D}`
  await wa('PUT', `/users/${user}`, { password: 'secret' })
  const auth = 'Basic ' + Buffer.from(`${user}:secret`).toString('base64')
  const headers = { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' }
  const session = await (await fetch(`${J}/jmap/session`, { headers })).json()
  const accountId = session.primaryAccounts['urn:ietf:params:jmap:mail']
  const call = async methodCalls => {
    const r = await fetch(`${J}/jmap`, { method: 'POST', headers, body: JSON.stringify({ using: USING, methodCalls }), signal: AbortSignal.timeout(30_000) })
    return (await r.json()).methodResponses
  }
  const upload = async raw => {
    const r = await fetch(`${J}/upload/${accountId}`, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'message/rfc822' }, body: raw })
    if (!r.ok) throw new Error(`upload -> ${r.status} ${await r.text()}`)
    return (await r.json()).blobId
  }
  let mailboxes = (await call([['Mailbox/get', { accountId }, '0']]))[0][1].list
  if (!mailboxes.some(m => m.name === 'Archive')) {
    await call([['Mailbox/set', { accountId, create: { ar: { name: 'Archive' } } }, '0']])
    mailboxes = (await call([['Mailbox/get', { accountId }, '0']]))[0][1].list
  }
  return { user, accountId, call, upload, inbox: mailboxes.find(m => m.role === 'inbox').id, archive: mailboxes.find(m => m.name === 'Archive').id }
}

// Raw message: text/plain body, plus an optional text/plain attachment.
function eml(a, n, subject, body, attachment) {
  const head = [`From: sender@${D}`, `To: ${a.user}`, `Subject: ${subject}`, `Date: Mon, 5 Oct 2026 10:00:0${n.length % 10} +0000`, `Message-ID: <${n}.${a.user}>`, 'MIME-Version: 1.0']
  if (!attachment) return [...head, 'Content-Type: text/plain; charset=utf-8', '', body, ''].join('\r\n')
  return [...head, 'Content-Type: multipart/mixed; boundary="b1"', '', '--b1', 'Content-Type: text/plain; charset=utf-8', '', body, '--b1',
    'Content-Type: text/plain; charset=utf-8; name="notes.txt"', 'Content-Disposition: attachment; filename="notes.txt"', '', attachment, '--b1--', ''].join('\r\n')
}

const out = []
const say = s => { console.log(s); out.push(s) }

// One case: import the emails (one Email/import per email, so uids follow the order), then run
// Email/query + SearchSnippet/get on the same filter.
async function scenario(label, emails, filters, extraMailbox = false) {
  const a = await account()
  const ids = {}
  for (const [n, subject, body, attachment, both] of emails) {
    const blobId = await a.upload(eml(a, n, subject, body, attachment))
    const [[, res]] = await a.call([['Email/import', { accountId: a.accountId, emails: { [n]: { blobId, mailboxIds: { [a.inbox]: true }, keywords: { $seen: true } } } }, '0']])
    if (!res.created?.[n]) throw new Error(`import failed: ${JSON.stringify(res.notCreated)}`)
    ids[n] = res.created[n].id
    if (both && extraMailbox) { // Email/import takes a single mailbox: add the second one with Email/set
      const [[, upd]] = await a.call([['Email/set', { accountId: a.accountId, update: { [ids[n]]: { [`mailboxIds/${a.archive}`]: true } } }, '0']])
      if (!upd.updated) throw new Error(`update failed: ${JSON.stringify(upd.notUpdated)}`)
    }
  }
  await sleep(800)
  say(label)
  for (const [n, subject, body, attachment, both] of emails) {
    say(`  ${n}: subject ${JSON.stringify(subject)}, body ${JSON.stringify(body)}${attachment ? `, attachment notes.txt ${JSON.stringify(attachment)}` : ', no attachment'}${both && extraMailbox ? ', in INBOX and Archive' : ''}`)
  }
  const name = id => Object.entries(ids).find(([, v]) => v === id)?.[0] ?? id
  for (const filter of filters) {
    const [[, q], [kind, s]] = await a.call([
      ['Email/query', { accountId: a.accountId, filter }, 'q'],
      ['SearchSnippet/get', { accountId: a.accountId, filter, '#emailIds': { resultOf: 'q', name: 'Email/query', path: '/ids' } }, 's'],
    ])
    const query = q.ids ? `[${q.ids.map(name).join(',')}]` : JSON.stringify(q)
    const snippets = kind === 'error'
      ? `ERROR ${s.type}: ${String(s.description ?? '').slice(0, 160)}`
      : `${s.list.map(x => `${name(x.emailId)} subject=${JSON.stringify(x.subject)} preview=${JSON.stringify(x.preview)}`).join(' | ') || '(empty list)'}; notFound=${JSON.stringify(s.notFound?.map(name) ?? null)}`
    say(`  filter ${JSON.stringify(filter)}`)
    say(`    Email/query: ${query}`)
    say(`    SearchSnippet/get: ${snippets}`)
  }
}

async function run() {
  await scenario('A. subject match, body and text attachment without the word',
    [['m1', 'Quarterly report', 'Hello there', 'numbers inside']],
    [{ subject: 'Quarterly' }, { text: 'Quarterly' }, { from: 'sender' }])
  await scenario('B. control: same email without attachment',
    [['m1', 'Quarterly report', 'Hello there']],
    [{ subject: 'Quarterly' }, { text: 'Quarterly' }])
  await scenario('C. control: the attachment contains the word',
    [['m1', 'Quarterly report', 'Hello there', 'Quarterly numbers inside']],
    [{ subject: 'Quarterly' }])
  await scenario('D. control: the body contains the word',
    [['m1', 'Quarterly report', 'The Quarterly figures', 'numbers inside']],
    [{ subject: 'Quarterly' }])
  await scenario('E. one failing email among others: the whole SearchSnippet/get fails',
    [['m1', 'Quarterly report', 'Quarterly figures'], ['m2', 'Quarterly report v2', 'Hello there', 'numbers inside'], ['m3', 'Quarterly report v3', 'Quarterly again']],
    [{ subject: 'Quarterly' }])
  await scenario('F. search values with Lucene query syntax characters (no attachment)',
    [['m1', '[Ticket] Server down (urgent)', 'Please look']],
    [{ subject: '[Ticket]' }, { subject: 'down (urgent' }, { text: 'Server' }])
  await scenario('G. an email in two mailboxes (INBOX uid 1 and Archive uid 1) and another one (INBOX uid 2)',
    [['m1', 'Shared word one', 'Shared body', undefined, true], ['m2', 'Shared word two', 'Shared body']],
    [{ subject: 'Shared' }], true)
}

const images = process.argv.slice(2).length ? process.argv.slice(2) : ['linagora/tmail-backend:memory-1.0.21.2', 'linagora/tmail-backend:memory-branch-master']
for (const image of images) {
  out.length = 0
  if (!process.env.NO_STACK) await startStack(image)
  try {
    await wa('PUT', `/domains/${D}`)
    say(`image ${image}`)
    await run()
    if (!process.env.NO_STACK) {
      const logs = compose(image, 'logs --no-color james')
      const npe = logs.split('\n').filter(l => /NullPointerException|at org\.apache\.james\.mailbox\.lucene\.search\.LuceneSearchHighlighter\.|at java\.base\/java\.util\.stream\.(FindOps|ReferencePipeline)/.test(l))
      say(`server log: ${npe.filter(l => /NullPointerException/.test(l)).length} NullPointerException line(s); first stack lines:`)
      const first = logs.split('\n').findIndex(l => /NullPointerException/.test(l))
      if (first >= 0) for (const l of logs.split('\n').slice(first, first + 12)) say(`  | ${l.replace(/^james-1\s*\|\s*/, '').slice(0, 200)}`)
    }
  } finally {
    writeFileSync(`${DIR}/results-${image.split(':').pop()}.txt`, out.join('\n') + '\n')
    if (!process.env.NO_STACK && !process.env.KEEP) compose(image, 'down -v')
  }
}
```
`docker-compose.yaml`:

```yaml
# TMail memory backend (Lucene search index) for the SearchSnippet/get repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing; the
# email query view is disabled, as in the Twake Mail web e2e stack, so that Email/query is
# always answered by the search index).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18464  JMAP
#   127.0.0.1:18465  WebAdmin
name: tmailbug-memory-lucene-search-snippet-npe

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18464:80'
      - '127.0.0.1:18465:8000'
```
`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one switches to Basic auth and disables the email query view (as the
# Twake Mail web e2e stack does, see #2682): Email/query is then answered by the search index.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18464
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
name: tmailbug-memory-lucene-search-snippet-npe

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
      - '127.0.0.1:18464:80'
      - '127.0.0.1:18465:8000'
```
</details>

### Expected result

RFC 8621 §5.1: `SearchSnippet/get` returns "An array of SearchSnippet objects for the requested Email ids" and `notFound` "An array of Email ids requested that could not be found"; the only errors listed besides the standard ones are `requestTooLarge` and `unsupportedFilter`. A snippet with `subject: null` and `preview: null` is a valid answer when nothing can be highlighted (example of §5.2). So: one snippet per requested email, no `serverFail`, no duplicate, no existing email in `notFound`.

**Actual** (`Email/query` returns the right emails in every case):

| case | filter | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|---|
| A. subject match; body and text attachment without the word | `subject: "Quarterly"` | **serverFail** (NPE) | **serverFail** (NPE) |
| A | `text: "Quarterly"` | **serverFail** (NPE) | **serverFail** (NPE) |
| A | `from: "sender"` | **serverFail** (NPE) | **serverFail** (NPE) |
| B. control: no attachment | `subject` / `text: "Quarterly"` | subject `<mark>Quarterly</mark> report`, preview null | same |
| C. control: the attachment contains the word | `subject: "Quarterly"` | subject and preview (from the attachment) highlighted | same |
| D. control: the body contains the word | `subject: "Quarterly"` | subject and preview highlighted | same |
| E. 3 results, only `m2` is like A | `subject: "Quarterly"` | **serverFail** for the 3 | **serverFail** for the 3 |
| F. subject `[Ticket] Server down (urgent)` | `subject: "[Ticket]"` | **serverFail** `ParseException: Cannot parse '[ticket]'` | same |
| F | `subject: "down (urgent"` | **serverFail** `ParseException: Cannot parse 'down (urgent'` | same |
| F | `text: "Server"` | subject highlighted | same |
| G. `m1` in INBOX and Archive, `m2` in INBOX | `subject: "Shared"` | **`m1` twice, `notFound: [m2]`** | **`m1` twice, `notFound: [m2]`** |

Full outputs: `results-memory-1.0.21.2.txt`, `results-memory-branch-master.txt`, `results-postgresql-1.0.21.2.txt`.

### Context

- `linagora/tmail-backend:memory-1.0.21.2`, `linagora/tmail-backend:memory-branch-master` (built 2026-10-02).
- **No usable control:** `linagora/tmail-backend:postgresql-1.0.21.2` (`COMPOSE=docker-compose.postgres.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2`) answers **every** `SearchSnippet/get` with `serverFail` "not implemented" (`PostgresTmailServer.FakeSearchHighlighter`, `tmail-backend/apps/postgres/src/main/java/com/linagora/tmail/james/app/PostgresTmailServer.java:233-237`), cases B-D included. The expected behaviour above comes from RFC 8621 §5.
- Image configuration, except `jmap.properties` (Basic auth, `view.email.query.enabled=false`, as in the Twake Mail web e2e stack). The memory app indexes text/plain and text/html attachments (`JsoupTextExtractor`, `MemoryMailboxModule`).
- Distributed image (OpenSearch highlighter) not tested.

### Additional information

**Suggested fix** (James, `LuceneSearchHighlighter`):

1. Skip the attachments without a fragment:

   ```java
   .map(Throwing.function(text -> highlighter.getBestFragment(analyzer, ATTACHMENT_TEXT_CONTENT_FIELD, text)))
   .filter(Objects::nonNull)
   .findFirst();
   ```
2. Escape the value before parsing (`QueryParser.escape(value)`), or build the highlight query from the analyzer's tokens (`QueryBuilder.createBooleanQuery(field, value)`) instead of the query-parser syntax; at worst, catch `ParseException` and return a snippet without highlight.
3. Search with the usual `maxQueryResults` (or `limit × number of mailboxes`) and keep one snippet per message id (`distinct` on `messageId`), as `LuceneMessageSearchIndex.searchWithoutCollapseThreads` does with `SearchUtil.distinct()`.

`LuceneSearchHighlighterTest` cases: "subject match with a non-matching text attachment", "subject with `[`", "message in two mailboxes".

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`): on the memory image (its e2e stack) a search whose results include one such email loses the highlights of the whole page (it falls back to results without highlights, documented in its `e2e/README.md`, "Search on the memory image"). Searches with `[` or `(` (common in subjects: `[JIRA]`, `Re: (…)`) do the same.
- tmail-flutter: its search sends `SearchSnippet/get` with the `Email/query` (`lib/features/thread/data/network/thread_api.dart`), catches the failed parse and logs a warning: the results show without highlights, for the whole page.
- Any Lucene-based James deployment.

**Related:** JAMES-4077 (previous NPE fix in the same class), #2009 and #2034 (query-string parsing errors on the OpenSearch side, same family as cause 2), #2682, #2684, #2685, #2686, the Lucene "expunge of consecutive UIDs empties the mailbox from the index" candidate, and the Lucene `hasKeyword` UID-collision and "subject/text search limited to 4-word prefixes" candidates.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
