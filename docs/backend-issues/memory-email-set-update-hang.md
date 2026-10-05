### Description of the bug

On the **memory** image, `Email/set` `update` misbehaves in two ways, both caused by `InMemoryMessageIdMapper.findMetadata(messageId)` (James, `mailbox/memory`) returning the metadata of **every message of every mailbox in the JVM** instead of the messages with that id:

1. **Data corruption.** An update of **more than 3 ids with the same patch** (`keywords/$seen: true`, `keywords/$flagged: true`, `keywords/X: null`, or `mailboxIds: {<one mailbox>: true}`) is applied to **every email of the account** whenever all of the account's emails sit in a single mailbox (typical for a new account where everything is in INBOX, or a Drafts-only account). The response's `updated` also lists ids that were never requested. Mark 4 mails as read → the whole mailbox is read; move 4 mails to Trash → the whole mailbox goes to Trash.
2. **Hang.** Once the update would read about **256 metadata rows from mailboxes the caller cannot read** (other users' emails × number of ids in the update), the `Email/set` call **never answers**, for every account, until messages are deleted. `Email/set create`, `Email/get`, `Email/query`, `Mailbox/get` keep working. With 130 emails of another user in the JVM, a 1-id update answers in 20 ms and a 2-id update hangs.

The postgresql image (`findMetadata` filters by message id in SQL) is not affected; Cassandra also filters by id. The data is in memory only, but the memory image is what many people use for demos, e2e stacks and client development (Twake Mail web e2e stack, `demo/`).

#### Cause (James upstream, all line numbers at james-project `9aac85900f`, the TMail submodule; unchanged on apache/james-project `master` today)

- `mailbox/memory/src/main/java/org/apache/james/mailbox/inmemory/mail/InMemoryMessageIdMapper.java:74-85`: `findMetadata(messageId)` lists all mailboxes, reads `MessageRange.all()` of each and maps every message, **without** `.filter(message -> message.getMessageId().equals(messageId))`. `findReactive` right below (lines 88-92) does filter.
- `mailbox/store/src/main/java/org/apache/james/mailbox/store/StoreMessageIdManager.java:203-211` (`messagesMetadata`): `flatMap(findMetadata, 4)` → `groupBy(mailboxId)` → `filterWhen(hasRight Read)` → `flatMap(identity)`. Groups rejected by `filterWhen` (mailboxes of other users) are never subscribed, so their elements stay buffered in `groupBy` (prefetch 256). Once ~256 such rows are queued, `groupBy` stops requesting and the `Flux` never completes. No thread is busy or blocked in James code (thread dumps saved by `repro.mjs` as `threaddump-*.txt`, not attached here): a pipeline waiting for demand. Same `groupBy` + `filterWhen` pattern in `getMessagesReactive` (lines 181-193).
- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/method/EmailSetUpdatePerformer.scala:118` collects `messagesMetadata` into `Map[MessageId, Iterable[metadata]]`. On memory this map holds **all the readable emails of the account**, not just the requested ids. Then `doUpdate` (lines 126-149): if all patches are equal, `metaData` spans a single mailbox (`singleMailbox`, line 130) and there are more than `RANGE_THRESHOLD` (3) ids, it computes `asRanges(metaData)` (line 151) over **all** those UIDs and calls `updateFlagsByRange` / `moveByRange`, and reports `metaData.keys` (lines 163, 176) as `updated`. `updateEachMessage` (≤ 3 ids, or several mailboxes) looks metadata up by id and is correct, hence the controls D and E below.

So the root cause is in James memory; the JMAP code only amplifies it (range update and `updated` built from what the store returned instead of from the request).

### Reproduction Steps

Two self-contained Node scripts (Node ≥ 22, no dependency, docker compose). Each starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-memory-email-set-update-hang`, `127.0.0.1:18410` JMAP, `127.0.0.1:18411` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates users through WebAdmin and talks JMAP:

- `repro-range.mjs`: for each case a new user creates 10 emails in Drafts (`keywords: {$draft: true}`), sends **one** `Email/set` update, then `Email/get`s the 10 emails. Then the hang trigger (cases F, G).
- `repro.mjs`: user `probe` owns 1 email; user `filler` creates emails step by step; after each step `probe` sends a 1-id `Email/set` update with a 10 s timeout. Then checks what still works, takes a thread dump, destroys 100 filler emails and retries.

Request of case A (4 of the 10 Drafts emails):

```json
["Email/set", {"accountId": "…", "update": {
  "1": {"keywords/$flagged": true}, "2": {"keywords/$flagged": true},
  "3": {"keywords/$flagged": true}, "4": {"keywords/$flagged": true}}}, "0"]
```

<details>
<summary>repro-range.mjs, repro.mjs, docker-compose.yaml, jmap.properties, docker-compose.postgres.yaml</summary>

`repro-range.mjs`:

```js
// Repro (data corruption): on the tmail-backend memory image, an Email/set update of MORE THAN 3
// ids with the same patch modifies EVERY email of the account when all of the account's emails
// sit in a single mailbox, and `updated` lists ids that were never requested.
// Also pins the trigger of the hang (repro.mjs): unreadable metadata rows x number of ids.
//
//   node repro-range.mjs [image ...]     default: linagora/tmail-backend:memory-1.0.21.2
//   NO_STACK=1 JMAP=... WA=... node repro-range.mjs   run against an already running server
//
// Same stack as repro.mjs (compose project tmailbug-memory-email-set-update-hang,
// JMAP 127.0.0.1:18410, WebAdmin 127.0.0.1:18411). For each case a NEW user is created, it
// creates 10 emails in its Drafts (Email/set create), then sends ONE Email/set update and
// reads back all 10 emails with Email/get.
//   A. flag add      update 4 ids  {"keywords/$flagged": true}       -> updateFlagsByRange
//   B. flag remove   update 4 ids  {"keywords/$draft": null}         -> updateFlagsByRange
//   C. move          update 4 ids  {"mailboxIds": {<Trash>: true}}   -> moveByRange
//   D. control       update 3 ids  {"keywords/$flagged": true}       (<= RANGE_THRESHOLD = 3)
//   E. control       one more email in INBOX first, then A           (emails in 2 mailboxes)
// Then the hang trigger, on the same server (other users' emails are "unreadable" rows):
//   F. one user with 300 own emails, 1-id update
//   G. ~130 emails of another user in the JVM, 1-id update, then 2-id update
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18410'
const W = process.env.WA ?? 'http://127.0.0.1:18411'
const PROJECT = 'tmailbug-memory-email-set-update-hang'
const USING = ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail']
const D = 'example.com'
const TIMEOUT = 10_000

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
}

let userSeq = 0
async function account(name) {
  const user = `${name}${(userSeq += 1)}@${D}`
  await wa('PUT', `/users/${user}`, { password: 'secret' })
  const headers = { Authorization: 'Basic ' + Buffer.from(`${user}:secret`).toString('base64'), 'Content-Type': 'application/json', Accept: 'application/json' }
  const session = await (await fetch(`${J}/jmap/session`, { headers })).json()
  const accountId = session.primaryAccounts['urn:ietf:params:jmap:mail']
  const call = async (methodCalls, timeout = 60_000) => {
    const r = await fetch(`${J}/jmap`, { method: 'POST', headers, body: JSON.stringify({ using: USING, methodCalls }), signal: AbortSignal.timeout(timeout) })
    return (await r.json()).methodResponses
  }
  const mailboxes = (await call([['Mailbox/get', { accountId }, '0']]))[0][1].list
  const role = r => mailboxes.find(m => m.role === r).id
  return { user, accountId, call, drafts: role('drafts'), inbox: role('inbox'), trash: role('trash') }
}

async function create(a, n, mailboxId = a.drafts, prefix = 'm') {
  const ids = []
  for (let done = 0; done < n;) {
    const batch = Math.min(50, n - done)
    const create = Object.fromEntries(Array.from({ length: batch }, (_, i) => [`c${i}`, {
      mailboxIds: { [mailboxId]: true }, keywords: { $draft: true }, subject: `${prefix}${done + i}`, from: [{ email: a.user }],
      bodyValues: { t: { value: 'x' } }, textBody: [{ partId: 't', type: 'text/plain' }],
    }]))
    const [[, res]] = await a.call([['Email/set', { accountId: a.accountId, create }, '0']])
    const created = Object.values(res.created ?? {})
    if (created.length !== batch) throw new Error(`create failed: ${JSON.stringify(res.notCreated)}`)
    ids.push(...created.map(c => c.id))
    done += batch
  }
  return ids
}

const out = []
const say = s => { console.log(s); out.push(s) }

async function rangeCase(label, { n = 4, patch, extraInInbox = false }) {
  const a = await account('range')
  const ids = await create(a, 10)
  if (extraInInbox) await create(a, 1, a.inbox, 'inbox')
  const target = ids.slice(0, n)
  const p = patch(a)
  const [[, res]] = await a.call([['Email/set', { accountId: a.accountId, update: Object.fromEntries(target.map(id => [id, p])) }, '0']])
  const [[, got]] = await a.call([['Email/get', { accountId: a.accountId, ids, properties: ['keywords', 'mailboxIds'] }, '0']])
  const touched = got.list.filter(e => {
    const k = Object.keys(e.keywords ?? {}).sort().join(',')
    const m = Object.keys(e.mailboxIds).join(',')
    return k !== '$draft' || m !== a.drafts
  }).length
  const updatedKeys = Object.keys(res.updated ?? {})
  const extra = updatedKeys.filter(id => !target.includes(id)).length
  say(`${label}`)
  say(`  request: ${target.length} ids  ${JSON.stringify(p)}`)
  say(`  response: updated=${updatedKeys.length} (of which ${extra} not requested), notUpdated=${Object.keys(res.notUpdated ?? {}).length}`)
  say(`  Email/get on the 10 Drafts emails: ${touched} modified, ${10 - touched} untouched  -> ${touched === target.length && extra === 0 ? 'OK' : 'WRONG'}`)
  if (touched !== target.length) say(`  sample untargeted email after the update: ${JSON.stringify(got.list.find(e => e.id === ids[9]))}`)
}

async function probe(a, ids) {
  const started = Date.now()
  try {
    const [[name, res]] = await a.call([['Email/set', { accountId: a.accountId, update: Object.fromEntries(ids.map(id => [id, { 'keywords/$seen': true }])) }, '0']], TIMEOUT)
    return name === 'Email/set' && Object.keys(res.updated ?? {}).length ? `OK (${Date.now() - started} ms)` : `FAIL ${JSON.stringify(res)}`
  } catch (e) {
    return e.name === 'TimeoutError' ? `NO ANSWER after ${TIMEOUT / 1000} s` : `FAIL ${e}`
  }
}

async function run(image) {
  if (!process.env.NO_STACK) await startStack(image)
  await wa('PUT', `/domains/${D}`)
  say(`image ${image}`)
  say('-- Email/set update scope (each case: new user, 10 emails in Drafts with keyword $draft)')
  await rangeCase('A. flag add, 4 ids', { patch: () => ({ 'keywords/$flagged': true }) })
  await rangeCase('B. flag remove, 4 ids', { patch: () => ({ 'keywords/$draft': null }) })
  await rangeCase('C. move to Trash, 4 ids', { patch: a => ({ mailboxIds: { [a.trash]: true } }) })
  await rangeCase('D. control: flag add, 3 ids', { n: 3, patch: () => ({ 'keywords/$flagged': true }) })
  await rangeCase('E. control: flag add, 4 ids, account also has 1 email in INBOX', { extraInInbox: true, patch: () => ({ 'keywords/$flagged': true }) })

  say('-- hang trigger')
  const big = await account('big')
  const bigIds = await create(big, 300)
  say(`F. user with 300 own emails (plus the 51 emails of cases A-E), 1-id update: ${await probe(big, bigIds.slice(0, 1))}`)
  if (!process.env.NO_STACK) { // G needs a fresh JVM
    compose(image, 'down -v'); await startStack(image); await wa('PUT', `/domains/${D}`)
    const other = await account('other'); await create(other, 130)
    const me = await account('me'); const mine = await create(me, 2)
    say(`G. fresh JVM, 130 emails of another user + 2 own: 1-id update: ${await probe(me, mine.slice(0, 1))}`)
    say(`   same, 2-id update (2 x 130 = 260 unreadable rows): ${await probe(me, mine)}`)
  }
}

const images = process.argv.slice(2).length ? process.argv.slice(2) : ['linagora/tmail-backend:memory-1.0.21.2']
for (const image of images) {
  out.length = 0
  await run(image)
  writeFileSync(`${DIR}/results-range-${image.split(':').pop()}.txt`, out.join('\n') + '\n')
  if (!process.env.NO_STACK) compose(image, 'down -v')
}
```

`repro.mjs`:

```js
// Repro: on the tmail-backend memory image, once about 256 messages exist in the JVM, every
// JMAP Email/set *update* (keywords, mailboxIds) never answers, for every account.
//
//   node repro.mjs [image ...]       default: linagora/tmail-backend:memory-1.0.21.2
//   KEEP=1 node repro.mjs            leave the last stack running
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-memory-email-set-update-hang,
// JMAP 127.0.0.1:18410, WebAdmin 127.0.0.1:18411), creates the users "probe" and "filler", then:
//   1. probe creates one email P in its Drafts (Email/set create);
//   2. filler creates emails with Email/set create (batches of 50, then one by one near the
//      threshold); after each step, probe runs Email/set update {keywords/$seen} on P with a
//      10 s timeout. Stops at the first update that does not answer;
//   3. checks that creates, Email/get, Email/query and Mailbox/get still answer while updates hang,
//      and that a fresh account's first update hangs too;
//   4. takes a JVM thread dump (kill -3), saved in threaddump-<tag>.txt;
//   5. destroys 100 filler emails (Email/set destroy) and probes the update again.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18410'
const W = process.env.WA ?? 'http://127.0.0.1:18411'
const PROJECT = 'tmailbug-memory-email-set-update-hang'
const USING = ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail']
const D = 'example.com'
const TIMEOUT = Number(process.env.TIMEOUT ?? 10_000)
const STEPS = (process.env.STEPS ?? '100,200,240,250,251,252,253,254,255,256,257,258,260,270,300,400,600').split(',').map(Number)

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

async function account(name) {
  const user = `${name}@${D}`
  await wa('PUT', `/users/${user}`, { password: 'secret' })
  const headers = { Authorization: 'Basic ' + Buffer.from(`${user}:secret`).toString('base64'), 'Content-Type': 'application/json', Accept: 'application/json' }
  const session = await (await fetch(`${J}/jmap/session`, { headers })).json()
  const accountId = session.primaryAccounts['urn:ietf:params:jmap:mail']
  const call = async (methodCalls, timeout = 60_000) => {
    const r = await fetch(`${J}/jmap`, { method: 'POST', headers, body: JSON.stringify({ using: USING, methodCalls }), signal: AbortSignal.timeout(timeout) })
    return (await r.json()).methodResponses
  }
  const mailboxes = (await call([['Mailbox/get', { accountId }, '0']]))[0][1].list
  return { user, accountId, call, drafts: mailboxes.find(m => m.role === 'drafts').id }
}

const email = (a, subject) => ({ mailboxIds: { [a.drafts]: true }, subject, from: [{ email: a.user }], bodyValues: { t: { value: 'x' } }, textBody: [{ partId: 't', type: 'text/plain' }] })

async function create(a, n, prefix) {
  const ids = []
  for (let done = 0; done < n;) {
    const batch = Math.min(50, n - done)
    const create = Object.fromEntries(Array.from({ length: batch }, (_, i) => [`c${i}`, email(a, `${prefix}${done + i}`)]))
    const [[, res]] = await a.call([['Email/set', { accountId: a.accountId, create }, '0']])
    const created = Object.values(res.created ?? {})
    if (created.length !== batch) throw new Error(`create failed: ${JSON.stringify(res.notCreated)}`)
    ids.push(...created.map(c => c.id))
    done += batch
  }
  return ids
}

let seen = false
async function probeUpdate(a, id) {
  seen = !seen
  const started = Date.now()
  try {
    const [[name, res]] = await a.call([['Email/set', { accountId: a.accountId, update: { [id]: { 'keywords/$seen': seen || null } } }, '0']], TIMEOUT)
    const ok = name === 'Email/set' && res.updated && id in res.updated
    return { ok, ms: Date.now() - started, detail: ok ? '' : JSON.stringify(res) }
  } catch (e) {
    return { ok: false, ms: Date.now() - started, detail: e.name === 'TimeoutError' ? `no answer after ${TIMEOUT / 1000} s` : String(e) }
  }
}
const fmt = r => (r.ok ? `OK (${r.ms} ms)` : `NO ANSWER / FAIL: ${r.detail}`)

async function timed(label, fn) {
  const started = Date.now()
  try { return `${label}: ${await fn()} (${Date.now() - started} ms)` } catch (e) { return `${label}: FAILED ${e.name === 'TimeoutError' ? 'no answer' : e} (${Date.now() - started} ms)` }
}

async function run(image) {
  const out = []
  const say = s => { console.log(s); out.push(s) }
  if (!process.env.NO_STACK) await startStack(image)
  await wa('PUT', `/domains/${D}`)
  const probe = await account('probe')
  const filler = await account('filler')
  const [p] = await create(probe, 1, 'probe-')
  let total = 1 // messages in the JVM
  say(`image ${image}`)
  let r = await probeUpdate(probe, p)
  say(`messages=${total}  Email/set update: ${fmt(r)}`)
  const fillerIds = []
  let hungAt = null
  for (const step of STEPS) {
    if (step <= total) continue
    fillerIds.push(...await create(filler, step - total, 'f'))
    total = step
    r = await probeUpdate(probe, p)
    say(`messages=${total}  Email/set update: ${fmt(r)}`)
    if (!r.ok) { hungAt = total; break }
  }
  if (hungAt === null) { say('no hang observed'); return out }

  say('-- while that update is pending:')
  say(await timed('  Email/set create', async () => (await create(probe, 1, 'during-')).length + ' created'))
  say(await timed('  Email/get', async () => (await probe.call([['Email/get', { accountId: probe.accountId, ids: [p], properties: ['subject', 'keywords'] }, '0']], TIMEOUT))[0][1].list.length + ' email'))
  say(await timed('  Email/query', async () => (await probe.call([['Email/query', { accountId: probe.accountId, filter: { inMailbox: probe.drafts } }, '0']], TIMEOUT))[0][1].ids.length + ' ids'))
  say(await timed('  Mailbox/get', async () => (await probe.call([['Mailbox/get', { accountId: probe.accountId }, '0']], TIMEOUT))[0][1].list.length + ' mailboxes'))
  const fresh = await account(`fresh${Date.now()}`)
  const [f] = await create(fresh, 1, 'fresh-')
  r = await probeUpdate(fresh, f)
  say(`  fresh account, first Email/set update on its only email: ${fmt(r)}`)

  if (!process.env.NO_STACK) {
    const tag = image.split(':').pop()
    sh(`docker compose -p ${PROJECT} exec -T james kill -3 1`)
    await sleep(2000)
    writeFileSync(`${DIR}/threaddump-${tag}.txt`, compose(image, 'logs --no-color --no-log-prefix --since 10s'))
    say(`  thread dump: threaddump-${tag}.txt`)
  }

  say(await timed('-- Email/set destroy of 100 filler emails', async () => {
    const [[, res]] = await filler.call([['Email/set', { accountId: filler.accountId, destroy: fillerIds.slice(0, 100) }, '0']], TIMEOUT)
    return `${res.destroyed?.length ?? 0} destroyed`
  }))
  r = await probeUpdate(fresh, f)
  say(`  after destroy, fresh account update: ${fmt(r)}`)
  return out
}

const images = process.argv.slice(2).length ? process.argv.slice(2) : ['linagora/tmail-backend:memory-1.0.21.2']
for (const image of images) {
  const out = await run(image)
  writeFileSync(`${DIR}/results-${image.split(':').pop()}.txt`, out.join('\n') + '\n')
  if (!process.env.NO_STACK && !(process.env.KEEP && image === images.at(-1))) compose(image, 'down -v')
}
```

`docker-compose.yaml`:

```yaml
# TMail memory backend for the Email/set update hang repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18410  JMAP
#   127.0.0.1:18411  WebAdmin
name: tmailbug-memory-email-set-update-hang

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18410:80'
      - '127.0.0.1:18411:8000'
```

`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18410
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```

`docker-compose.postgres.yaml`:

```yaml
# Control run on the postgresql flavour (same ports, same Basic-auth jmap.properties):
# The postgresql image ships no /root/conf/keystore: reuse the memory image's test keystore first:
#   docker run --rm --entrypoint cat linagora/tmail-backend:memory-1.0.21.2 /root/conf/keystore > keystore
#   COMPOSE=docker-compose.postgres.yaml node repro-range.mjs linagora/tmail-backend:postgresql-1.0.21.2
name: tmailbug-memory-email-set-update-hang

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
      - '127.0.0.1:18410:80'
      - '127.0.0.1:18411:8000'
```

</details>

### Expected result

- Only the requested emails are modified, and `updated` only contains requested ids (RFC 8620 §5.3: the server applies each patch to the record of that id; `updated` maps the ids that were updated).
- `Email/set` update answers regardless of how many emails other accounts hold.

**Actual** (`repro-range.mjs`, then `repro.mjs`):

| case | `memory-1.0.21.2` | `memory-branch-master` | `postgresql-1.0.21.2` (control) |
|---|---|---|---|
| A. `keywords/$flagged: true` on 4 of 10 Drafts emails | **10 modified, `updated` has 10 ids** | **10 / 10** | 4 / 4 |
| B. `keywords/$draft: null` on 4 of 10 | **10 modified, 10 ids** | **10 / 10** | 4 / 4 |
| C. `mailboxIds: {Trash: true}` on 4 of 10 | **10 moved to Trash, 10 ids** | **10 / 10** | 4 / 4 |
| D. control: 3 ids (≤ `RANGE_THRESHOLD`) | 3 / 3 | 3 / 3 | 3 / 3 |
| E. control: 4 ids, account also has 1 email in INBOX | 4 / 4 | 4 / 4 | 4 / 4 |
| F. user with 300 own emails (+51 of other users), 1-id update | OK, 7 ms | OK, 6 ms | OK, 12 ms |
| G. 130 emails of another user, 1-id update | OK, 24 ms | OK, 19 ms | OK, 29 ms |
| G. same, 2-id update (2 × 130 = 260 unreadable rows) | **no answer after 10 s** | **no answer after 10 s** | OK, 13 ms |
| `repro.mjs`: 1-id update with 1…258 emails of another user | OK, 3-6 ms | OK, 2-7 ms | – |
| `repro.mjs`: same with 260 | **no answer** | **no answer** | – |
| while hung: `Email/set create`, `Email/get`, `Email/query`, `Mailbox/get` | answer | answer | – |
| while hung: first update of a brand new account | **no answer** | **no answer** | – |
| after destroying 100 of the filler emails | update OK again | update OK again | – |

The hung requests never complete: an update observed earlier on the Twake Mail web e2e stack was still pending after 400 s.

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (2026-09-30), `linagora/tmail-backend:memory-branch-master` (built 2026-10-02); control on `linagora/tmail-backend:postgresql-1.0.21.2` with `postgres:16` (`COMPOSE=docker-compose.postgres.yaml`, which also mounts the memory image's test keystore since the postgresql image ships none).
- Image configuration, except `jmap.properties` (Basic auth). Emails created with `Email/set create`; delivery through `EmailSubmission` gives the same hang (observed on the Twake Mail web e2e stack, which runs `memory-1.0.21.2`).
- Distributed image not tested; `CassandraMessageIdMapper.findMetadata` (lines 147-150) reads `imapUidDAO.retrieve(messageId)`, i.e. by message id.

### Additional information

**Suggested fix** (James)

1. `InMemoryMessageIdMapper.findMetadata`: filter by id, e.g. reuse `findReactive(ImmutableList.of(messageId), FetchType.METADATA)` and map to `ComposedMessageIdWithMetaData`. This alone fixes both symptoms on memory. A `MessageIdMapperTest` case (`findMetadata` must only return the given message when the mailbox holds others) would catch it for every backend.
2. `StoreMessageIdManager.messagesMetadata` and `getMessagesReactive`: do not leave `groupBy` groups unconsumed. Either drain the rejected groups (`flatMap(group -> hasRight(group.key()).flatMapMany(ok -> ok ? group : group.thenMany(Flux.empty())))`), or resolve the readable mailbox ids first and `filter` on them. Otherwise any backend can stall when one request touches ≥ 256 rows of unreadable mailboxes (not verified on Cassandra/Postgres, which need that many requested ids).
3. Defensive, in `EmailSetUpdatePerformer`: restrict `metaData` to the requested ids before `doUpdate`, and build `updated` from the requested ids, so a store bug cannot widen a range update to unrequested messages.

**Impact on clients**

- tmail-flutter sends one patch per id with the same value for "mark as read/unread", "star/unstar" and labels on a selection (`model/lib/extensions/list_email_id_extension.dart`, `generateMapUpdateObjectMarkAsRead`, `…MarkAsStar`, `…Label`). On memory, selecting 4+ emails in a mailbox-only account marks the whole mailbox. Its move uses `mailboxIds/<id>` patches, so it does not take the `moveByRange` path, but a full `mailboxIds` replacement (case C) does.
- Twake Mail web (`twake-mail-frontend`): keyword changes are single-id today (`useSetKeyword.ts`), so no corruption yet, but its e2e stack runs `memory-1.0.21.2` and every `Email/set` update (keyword changes, and the `onSuccessUpdateEmail` of a send) hung once a few hundred emails had been delivered to the test users. Any future bulk action (select + mark as read) would hit the corruption.
- Production deployments (distributed, postgresql) are not affected as far as tested.

**Workarounds**

- Clients: send at most 3 ids per `Email/set` update on memory. This avoids the corruption, not the hang.
- Server: `james.jmap.email.set.range.threshold` (system property read at `EmailSetUpdatePerformer.scala:44`, e.g. in `jvm.properties`) set very high disables the range path, hence the corruption (not tested). The hang remains.
- Keep memory stacks small or short-lived; destroying emails releases the stall.

**Related:** #2682 (other memory-image issue found while setting up the same e2e stack), #2685 and #2686 (other Email/set and Email/get issues found during the same work).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
