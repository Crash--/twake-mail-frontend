### Description of the bug

On the **memory** image (Lucene search index), the `subject`, `text` and `body` conditions of `Email/query` only match when the searched string, upper-cased, is a **prefix of one whitespace-separated token** of the field, **or of a run of at most 4 consecutive tokens**. Consequences:

- searching an **exact subject (or body sentence) of 5 words or more finds nothing**, while its first 4 words do: `"Email 1 subject Tag 1"`, `"Mail 1 of Tag 1"`, `"Quarterly budget review meeting notes"`;
- a word **glued to a `<`** (or any leading punctuation) is not found: subject `Invitation <Team sync> tomorrow`, search `Team` or `Team sync` → nothing.

The postgresql image (scanning search) finds all of them. Short or prefix searches work, which is why this goes unnoticed: it bites when a user pastes a subject, and in tests that wait for an email by its subject.

#### Cause (James upstream, line numbers at james-project `9aac85900f`, the TMail submodule; identical on apache/james-project `master` today)

- Index side: headers and body are `TextField`s (`LuceneIndexableDocument.java:165-168`, `:205-206`, in `mailbox/lucene/src/main/java/org/apache/james/mailbox/lucene/search/`) analyzed by `LenientImapSearchAnalyzer` (`LenientImapSearchAnalyzer.java:35-50`, set on the `IndexWriter` at `LuceneMessageSearchIndex.java:245`): **whitespace** tokenizer, upper-case filter, then **shingles of 2 to `DEFAULT_MAX_TOKEN_LENGTH = 4`** tokens (plus unigrams). `Invitation <Team sync> tomorrow` is indexed as `INVITATION`, `<TEAM`, `SYNC>`, `TOMORROW`, `INVITATION <TEAM`, `<TEAM SYNC>`, …, `INVITATION <TEAM SYNC> TOMORROW`; no term is longer than 4 words.
- Query side: the value is **not analyzed**. `subject` → `SearchQuery.subject` → `HeaderCriterion("Subject", ContainsOperator)` → `createHeaderQuery` (`LuceneMessageSearchIndex.java:498-512`, `:506`) → `createTermQuery` (`:487-493`), which builds `new PrefixQuery(new Term("header_SUBJECT", value.toUpperCase()))` (`suffixMatch` is `false` by default, :218, and nothing in the memory app enables it). `text` and `body` go through the same `createTermQuery` for the body, headers and attachment fields (`createTextQuery`, `:701-715`; JMAP mapping in `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/utils/search/MailboxFilter.scala:243-258` and `:305-315`).

So `PrefixQuery("QUARTERLY BUDGET REVIEW MEETING NOTES")` needs a single indexed term starting with those 5 words, and none exists; `PrefixQuery("TEAM")` needs a term starting with `TEAM`, and the token is `<TEAM`.

With `setEnableSuffixMatch(true)` (`WildcardQuery *value*`) the `<Team` case and infix searches would match, but not the 5-word case, and the javadoc (:290-296) warns about its cost.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-memory-lucene-text-search-prefix-shingles`, `127.0.0.1:18462` JMAP, `127.0.0.1:18463` WebAdmin), with a mounted `jmap.properties` that switches to Basic auth (the image's JWT key files are missing) and sets `view.email.query.enabled=false`, so that `Email/query` is answered by the search index. One user, 6 emails created in INBOX with `Email/set`, then one `Email/query {inMailbox: INBOX, <condition>}` per case.

Request of the first failing case:

```json
["Email/query", {"accountId": "…", "filter": {"inMailbox": "<INBOX>", "subject": "Quarterly budget review meeting notes"}}, "0"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties, docker-compose.postgres.yaml</summary>

`repro.mjs`:

```js
// Repro: on the tmail-backend memory image (Lucene search index), Email/query `subject`, `text`
// and `body` conditions only match when the searched string, upper-cased, is a PREFIX of one
// whitespace-separated token of the field or of a run of at most 4 consecutive tokens (the
// analyzer's shingles). So a search for an exact subject of 5 words or more finds nothing, nor
// does a word glued to a "<" or a pair of words separated by punctuation.
// No email is sent: the emails are created with Email/set.
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   COMPOSE=docker-compose.postgres.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-memory-lucene-text-search-prefix-shingles,
// JMAP 127.0.0.1:18462, WebAdmin 127.0.0.1:18463, email query view disabled so that Email/query is
// answered by the search index), creates one user with 7 emails in INBOX, then runs
// Email/query {inMailbox: INBOX, <condition>} for each case and compares with the expected email.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18462'
const W = process.env.WA ?? 'http://127.0.0.1:18463'
const PROJECT = 'tmailbug-memory-lucene-text-search-prefix-shingles'
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

async function account(user) {
  await wa('PUT', `/users/${user}`, { password: 'secret' })
  const headers = { Authorization: 'Basic ' + Buffer.from(`${user}:secret`).toString('base64'), 'Content-Type': 'application/json', Accept: 'application/json' }
  const session = await (await fetch(`${J}/jmap/session`, { headers })).json()
  const accountId = session.primaryAccounts['urn:ietf:params:jmap:mail']
  const call = async methodCalls => {
    const r = await fetch(`${J}/jmap`, { method: 'POST', headers, body: JSON.stringify({ using: USING, methodCalls }), signal: AbortSignal.timeout(30_000) })
    return (await r.json()).methodResponses
  }
  const mailboxes = (await call([['Mailbox/get', { accountId }, '0']]))[0][1].list
  return { user, accountId, call, inbox: mailboxes.find(m => m.role === 'inbox').id }
}

const EMAILS = {
  e1: { subject: 'Email 1 subject Tag 1', body: 'first' },
  e2: { subject: 'Mail 1 of Tag 1', body: 'second' },
  e3: { subject: 'Quarterly budget review meeting notes', body: 'third' },
  e4: { subject: 'Invitation <Team sync> tomorrow', body: 'fourth' },
  e5: { subject: 'Hello, world again', body: 'fifth' },
  e6: { subject: 'Body test', body: 'The quick brown fox jumps over the lazy dog' },
}

// [label, condition, expected emails, note]
const CASES = [
  ['subject, 1 word', { subject: 'Quarterly' }, ['e3']],
  ['subject, 2 words', { subject: 'Quarterly budget' }, ['e3']],
  ['subject, 4 words', { subject: 'Quarterly budget review meeting' }, ['e3']],
  ['subject, 5 words = the whole subject', { subject: 'Quarterly budget review meeting notes' }, ['e3']],
  ['subject, last 4 words', { subject: 'budget review meeting notes' }, ['e3']],
  ['subject, 2 non-adjacent words', { subject: 'budget notes' }, ['e3'], 'RFC: tokens searched separately'],
  ['subject, lower case, 4 words', { subject: 'quarterly budget review meeting' }, ['e3']],
  ['subject "Email 1 subject Tag 1" (whole)', { subject: 'Email 1 subject Tag 1' }, ['e1']],
  ['subject "Email 1 subject Tag" (4 words)', { subject: 'Email 1 subject Tag' }, ['e1']],
  ['subject "Mail 1 of Tag 1" (whole)', { subject: 'Mail 1 of Tag 1' }, ['e2']],
  ['subject "Mail 1 of Tag" (4 words)', { subject: 'Mail 1 of Tag' }, ['e2']],
  ['subject "Tag 1"', { subject: 'Tag 1' }, ['e1', 'e2']],
  ['subject "Team" (word after "<")', { subject: 'Team' }, ['e4']],
  ['subject "Team sync" (words after "<")', { subject: 'Team sync' }, ['e4']],
  ['subject "Invitation"', { subject: 'Invitation' }, ['e4']],
  ['subject "Hello world" (comma in the subject)', { subject: 'Hello world' }, ['e5'], 'RFC: tokens searched separately'],
  ['subject "Hello, world" (verbatim)', { subject: 'Hello, world' }, ['e5']],
  ['subject "udget" (inside a word)', { subject: 'udget' }, ['e3'], 'RFC MAY whole-word: either OK'],
  ['text, 4 words of a subject', { text: 'Quarterly budget review meeting' }, ['e3']],
  ['text, whole 5-word subject', { text: 'Quarterly budget review meeting notes' }, ['e3']],
  ['text "Email 1 subject Tag 1"', { text: 'Email 1 subject Tag 1' }, ['e1']],
  ['text "Team sync"', { text: 'Team sync' }, ['e4']],
  ['text, 4 words of a body', { text: 'brown fox jumps over' }, ['e6']],
  ['text, 5 words of a body', { text: 'brown fox jumps over the' }, ['e6']],
  ['body, 5 words of a body', { body: 'brown fox jumps over the' }, ['e6']],
  ['text, quoted phrase \'"Tag 1"\'', { text: '"Tag 1"' }, ['e1', 'e2'], 'RFC SHOULD phrase search'],
]

const out = []
const say = s => { console.log(s); out.push(s) }

async function run() {
  const a = await account(`search@${D}`)
  const ids = {}
  for (const [n, { subject, body }] of Object.entries(EMAILS)) {
    const [[, res]] = await a.call([['Email/set', { accountId: a.accountId, create: { [n]: {
      mailboxIds: { [a.inbox]: true }, keywords: { $seen: true }, subject, from: [{ email: `sender@${D}` }], to: [{ email: a.user }],
      bodyValues: { t: { value: body } }, textBody: [{ partId: 't', type: 'text/plain' }],
    } } }, '0']])
    if (!res.created?.[n]) throw new Error(`create failed: ${JSON.stringify(res.notCreated)}`)
    ids[n] = res.created[n].id
    say(`${n}: subject ${JSON.stringify(subject)}, body ${JSON.stringify(body)}`)
  }
  await sleep(1000)
  const name = id => Object.entries(ids).find(([, v]) => v === id)?.[0] ?? id
  let wrong = 0
  for (const [label, cond, expected, note] of CASES) {
    const [[, res]] = await a.call([['Email/query', { accountId: a.accountId, filter: { inMailbox: a.inbox, ...cond } }, '0']])
    const got = res.ids ? `[${res.ids.map(name).sort().join(',')}]` : JSON.stringify(res)
    const exp = `[${expected.join(',')}]`
    const ok = got === exp
    if (!ok && !note) wrong += 1
    say(`${ok ? 'OK   ' : 'WRONG'} ${label}: ${JSON.stringify(cond)} -> ${got} (expected ${exp})${note ? `  [${note}]` : ''}`)
  }
  say(`${wrong} unexpected result(s) (cases with a note excluded)`)
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
# TMail memory backend (Lucene search index) for the subject / text search repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing; the
# email query view is disabled, as in the Twake Mail web e2e stack, so that Email/query is
# always answered by the search index).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18462  JMAP
#   127.0.0.1:18463  WebAdmin
name: tmailbug-memory-lucene-text-search-prefix-shingles

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18462:80'
      - '127.0.0.1:18463:8000'
```
`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one switches to Basic auth and disables the email query view (as the
# Twake Mail web e2e stack does, see #2682): Email/query is then answered by the search index.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18462
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
name: tmailbug-memory-lucene-text-search-prefix-shingles

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
      - '127.0.0.1:18462:80'
      - '127.0.0.1:18463:8000'
```
</details>

### Expected result

RFC 8621 §4.4.1 deliberately leaves the exact matching of `String` conditions open, but: `subject` "Looks for the text in the Subject header field"; `text` "MUST look up text in the From, To, Cc, Bcc, and Subject header fields of the message and SHOULD look inside any text/* […] body parts"; "Text SHOULD be matched in a case-insensitive manner"; "Outside of a phrase, white space SHOULD be treated as dividing separate tokens that may be searched for separately but MUST all be present for the Email to match the filter". No reading of these lets the exact, complete subject of an email return nothing while its first 4 words find it.

**Actual** (`Email/query` result; emails: `e1` "Email 1 subject Tag 1", `e2` "Mail 1 of Tag 1", `e3` "Quarterly budget review meeting notes", `e4` "Invitation <Team sync> tomorrow", `e6` subject "Body test", body "The quick brown fox jumps over the lazy dog"):

| condition | expected | `memory-1.0.21.2` | `memory-branch-master` | `postgresql-1.0.21.2` (control) |
|---|---|---|---|---|
| `subject: "Quarterly"` | e3 | e3 | e3 | e3 |
| `subject: "Quarterly budget review meeting"` (4 words) | e3 | e3 | e3 | e3 |
| `subject: "Quarterly budget review meeting notes"` (5 words, whole subject) | e3 | **none** | **none** | e3 |
| `subject: "budget review meeting notes"` (last 4 words) | e3 | e3 | e3 | e3 |
| `subject: "Email 1 subject Tag"` / `"Mail 1 of Tag"` (4 words) | e1 / e2 | e1 / e2 | e1 / e2 | e1 / e2 |
| `subject: "Email 1 subject Tag 1"` (whole) | e1 | **none** | **none** | e1 |
| `subject: "Mail 1 of Tag 1"` (whole) | e2 | **none** | **none** | e2 |
| `subject: "Tag 1"` | e1, e2 | e1, e2 | e1, e2 | e1, e2 |
| `subject: "Invitation"` | e4 | e4 | e4 | e4 |
| `subject: "Team"` (after `<`) | e4 | **none** | **none** | e4 |
| `subject: "Team sync"` (after `<`) | e4 | **none** | **none** | e4 |
| `text: "Quarterly budget review meeting"` (4 words) | e3 | e3 | e3 | e3 |
| `text: "Quarterly budget review meeting notes"` | e3 | **none** | **none** | e3 |
| `text: "Email 1 subject Tag 1"` | e1 | **none** | **none** | e1 |
| `text: "Team sync"` | e4 | **none** | **none** | e4 |
| `text: "brown fox jumps over"` (4 words of the body) | e6 | e6 | e6 | e6 |
| `text: "brown fox jumps over the"` (5 words of the body) | e6 | **none** | **none** | e6 |
| `body: "brown fox jumps over the"` | e6 | **none** | **none** | e6 |

Full outputs (they include a few more rows): `results-memory-1.0.21.2.txt`, `results-memory-branch-master.txt`, `results-postgresql-1.0.21.2.txt`.

### Context

- `linagora/tmail-backend:memory-1.0.21.2`, `linagora/tmail-backend:memory-branch-master` (built 2026-10-02). Control on `linagora/tmail-backend:postgresql-1.0.21.2` with `postgres:16` (`COMPOSE=docker-compose.postgres.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2`, which also mounts the memory image's test keystore). Its search implementation is `scanning` (case-insensitive substring), not an index.
- Image configuration, except `jmap.properties` (Basic auth, `view.email.query.enabled=false`, as in the Twake Mail web e2e stack).
- The TMail memory app gets Lucene from James' `MemoryMailboxModule` (`LuceneSearchMailboxModule`); TMail does not override the search filters for it. Distributed image (OpenSearch, own analyzers, `TmailCriterionConverter`) not tested.

### Additional information

**Suggested fix** (James, `LuceneMessageSearchIndex`):

1. Query side (no reindex needed): split the value the way the index does (whitespace, upper-case). Up to 4 tokens, keep today's `PrefixQuery` on the joined string. Beyond, AND the tokens (`BooleanQuery` of `MUST` `PrefixQuery`/`TermQuery` per token, or an ordered `SpanNearQuery` / `PhraseQuery` over the unigrams if word order matters), which is what RFC 8621 §4.4.1 recommends ("white space SHOULD be treated as dividing separate tokens […] MUST all be present"). Reusing the analyzer of the index on the query (`QueryBuilder.createPhraseQuery`, without the shingle filter) gives the same result.
2. Index side (needs a reindex of existing data): a tokenizer that does not keep leading/trailing punctuation in the tokens (e.g. `StandardTokenizer`, or a pattern tokenizer on `[\s\p{Punct}]`), so that `<Team` and `Hello,` index `TEAM` and `HELLO`.

A `LuceneMessageSearchIndexTest` case "search a subject of more than 4 words" would cover (1).

**Not Lucene-specific, for the record:** both backends match a contiguous substring, not separate tokens: `subject: "budget notes"` (two non-adjacent words of e3) and `subject: "Hello world"` on `Hello, world again` find nothing on the postgresql control either, and a quoted phrase (`text: "\"Tag 1\""`) is searched with its quotes on both. These deviate from the RFC SHOULDs quoted above, but they are a James-wide choice, not this bug. Searching inside a word (`subject: "udget"`) fails on Lucene only; the RFC allows whole-word matching ("MAY be matched on a whole-word basis"), so that one is conformant.

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`): on the memory image (its e2e stack) a search typed or pasted with more than 4 words, or with a word after `<`, finds nothing; its e2e suite types shorter queries and cannot wait for an email by a long subject (it lists the mailbox instead), as documented in its `e2e/README.md` ("Search on the memory image").
- tmail-flutter: same for its search bar and advanced search (`subject`, `text`) on the memory image.
- Any Lucene-based James deployment.

**Related:** #2009 and #2034 (subject search failures on the distributed platform: OpenSearch query-string syntax and subject normalization, fixed on the TMail side, different cause), #1775 (subject n-grams, OpenSearch), #2682, #2684, #2685, #2686, the Lucene "expunge of consecutive UIDs empties the mailbox from the index" candidate (`createQuery(MessageRange)`) and the Lucene `hasKeyword` / `notKeyword` UID-collision candidate, same class.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
