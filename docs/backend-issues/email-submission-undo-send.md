### Description of the bug

A client cannot implement "undo send" or "send later" safely on tmail-backend, and the server's answers mislead it:

1. **`EmailSubmission/set` `update` and `destroy` are silently ignored.** `update: {"<submissionId>": {"undoStatus": "canceled"}}` is answered with neither `updated` nor `notUpdated`. Per RFC 8620 §5.3, `notUpdated` is "null if all successful": a client reads this as **"canceled"**, and the email is delivered anyway. Same for `destroy`.
2. **`EmailSubmission/get`, `/changes`, `/query` answer `unknownMethod`**, although the session advertises `urn:ietf:params:jmap:submission`, which RFC 8621 §1.3.2 defines as "support for the Identity and EmailSubmission data types and associated API methods" (§7.1-7.5).
3. **The delay is honoured although the session says it is not supported.** The account capability is `{"maxDelayedSend": 0, "submissionExtensions": {}}` (RFC 8621 §1.3.2: "This is 0 if the server does not support delayed send"), yet `envelope.mailFrom.parameters` `holdFor` (up to 86400 s) and `holdUntil` are accepted and, on the memory image, the email is held for that time.
4. **On the RabbitMQ mail queue (distributed image, postgresql image with RabbitMQ) the delay is dropped, while `sendAt` announces it.** The submission is created with `sendAt` = now + `holdFor`, and the email is delivered within a second (`RabbitMQMailQueue - Ignored delay upon enqueue`). RFC 8621 §7: `sendAt` "If the client successfully used FUTURERELEASE [RFC4865] with the submission, this MUST be the time when the server will release the message; otherwise, it MUST be the time the EmailSubmission was created."
5. Smaller deviations seen on the way:
   - `created` only contains `id` and `sendAt`. RFC 8620 §5.3: `created` "includes all server-set properties", so also `threadId` and `undoStatus` (which, per RFC 8621 §7, "will always be "final"" on a server that cannot unsend).
   - Only the camel-case keys `holdFor` / `holdUntil` are accepted; `HOLDFOR`, the keyword as written in RFC 4865 §3, is rejected with "Unsupported parameterName". SMTP parameter keywords are case-insensitive (RFC 5321 §2.4, RFC 5234 §2.3).
   - Delay errors are SetErrors of type `invalidArguments` ("Invalid delayed time!", "Unsupported parameterName"), which is a method-level error (RFC 8620 §3.6.2), not a SetError type; `invalidProperties` with `properties: ["envelope"]` fits.

Point 1 and 2 are the known missing storage of [JAMES-3543](https://issues.apache.org/jira/browse/JAMES-3543) (open since 2021), whose description already lists naive but spec-compliant answers ("EmailSubmission/get could always return notFound", "EmailSubmission/query always returns empty", "EmailSubmission/set update could be always rejected", "destroy could be always rejected"). RFC 8621 §7 explicitly allows them: "For very basic SMTP proxies, this MAY be immediately after creation" (destroying the submission object). None of them is implemented: the dangerous part is the silent success of point 1, not the missing feature. Points 3 and 4 are not covered by JAMES-3543.

#### Cause (James upstream, line numbers at james-project `9aac85900f`, the TMail submodule; identical on apache/james-project `master` today)

- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/mail/EmailSubmissionSet.scala:46-49`: `EmailSubmissionSetRequest(accountId, create, onSuccessUpdateEmail, onSuccessDestroyEmail)` has no `update`/`destroy` field; the JSON reader drops unknown arguments, and `EmailSubmissionSetMethod.doProcess` (`method/EmailSubmissionSetMethod.scala:199-224`) only answers `created`/`notCreated`. `EmailSubmissionSetResponse` (`EmailSubmissionSet.scala:139-146`) cannot even carry `updated`/`notUpdated`.
- No `EmailSubmission/get`, `/changes`, `/query` method is registered; James' annotated specification says so (`server/protocols/jmap-rfc-8621/doc/specs/spec/mail/messagesubmission.mdown:154-171`, "Not implemented"; line 205, "Only EmailSubmission/set create is supported. No result is stored.").
- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/core/Capability.scala:194-215`: `SubmissionCapabilityFactory` advertises `maxDelayedSend: 0` and no `FUTURERELEASE` unless `delay.sends.enabled=true` (`JmapRfc8621Configuration.scala:51, 89`; documented as "Whether to support or not the delay send with JMAP protocol", `docs/modules/servers/partials/configure/jmap.adoc:121-122`). But `EmailSubmissionSetMethod.validateDelay` (lines 377-382) checks the delay against the hard-coded `SubmissionCapabilityFactory.maximumDelays` (1 day), not against that setting, and `sendEmail` (lines 287-289, 303-305) enqueues with the delay and computes `sendAt = now + delay` whatever the configuration and whatever the queue does with it.
- `server/queue/queue-rabbitmq/src/main/java/org/apache/james/queue/rabbitmq/RabbitMQMailQueue.java:78-91`: `enQueue(mail, delay)` / `enqueueReactive(mail, delay)` log "Ignored delay upon enqueue" and enqueue immediately. The distributed image uses this queue (`DistributedServer`, `RabbitMQMailQueueModule`), and so does the postgresql image when RabbitMQ is configured (`PostgresTmailServer.chooseQueueModules`); the memory image (`MemoryMailQueue`) and the postgresql image without RabbitMQ (ActiveMQ) honour delays.
- `EmailSubmissionSet.scala:40-43` (`ParameterName.holdFor` / `holdUntil`) and `EmailSubmissionSetMethod.scala:73, 364-374, 433-445`: parameter names compared case-sensitively.
- `EmailSubmissionSetMethod.scala:112-117`: `DateTimeParseException` / `IllegalArgumentException` → `SetError.invalidArguments`.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-email-submission-undo-send`, `127.0.0.1:18420` JMAP, `127.0.0.1:18421` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates `alice@example.com`, and every email goes from alice to alice (local delivery only).

`COMPOSE=docker-compose.rabbitmq.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2` runs the same script on the postgresql image with `postgres:16` and `rabbitmq:3.13.3-management` (mounted `rabbitmq.properties`), i.e. with the distributed image's mail queue.

Requests of steps 1 and 2:

```json
["EmailSubmission/set", {"accountId": "…", "create": {"s": {"emailId": "…",
  "envelope": {"mailFrom": {"email": "alice@example.com", "parameters": {"holdFor": "20"}}, "rcptTo": [{"email": "alice@example.com"}]}}}}, "0"]
["EmailSubmission/set", {"accountId": "…", "update": {"<id of the created submission>": {"undoStatus": "canceled"}}}, "0"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties, docker-compose.rabbitmq.yaml, rabbitmq.properties</summary>

`repro.mjs`:

```js
// Repro: "undo send" on tmail-backend. The session advertises maxDelayedSend: 0 (no delayed send),
// yet EmailSubmission/set create honours the FUTURERELEASE parameter holdFor/holdUntil; then
// EmailSubmission/set update {undoStatus: "canceled"} is silently ignored (no updated, no
// notUpdated: per RFC 8620 §5.3 the client reads this as success) and the message is delivered.
// EmailSubmission/get, /changes, /query answer unknownMethod.
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   COMPOSE=docker-compose.rabbitmq.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2
//                                  (mail queue of the distributed image: RabbitMQMailQueue)
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-email-submission-undo-send,
// JMAP 127.0.0.1:18420, WebAdmin 127.0.0.1:18421), creates the user alice, and every email is
// sent by alice to herself (local delivery only):
//   0. session: urn:ietf:params:jmap:submission account capability;
//   1. EmailSubmission/set create with envelope.mailFrom.parameters {holdFor: "20"};
//   2. right after: EmailSubmission/set update {<id>: {undoStatus: "canceled"}}, then
//      EmailSubmission/get, /changes, /query, /set destroy on that id;
//   3. polls INBOX: when does the message arrive?
//   4. other parameters: no parameter (control), holdFor 86400, holdFor 86401, HOLDFOR (RFC 4865
//      spelling), holdUntil = now + 15 s;
//   5. onSuccessUpdateEmail keyed by the server-set EmailSubmission id of step 1.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18420'
const W = process.env.WA ?? 'http://127.0.0.1:18421'
const PROJECT = 'tmailbug-email-submission-undo-send'
const SUBMISSION = 'urn:ietf:params:jmap:submission'
const USING = ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail', SUBMISSION]
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
}

async function account(name) {
  const user = `${name}@${D}`
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
  return { user, accountId, session, call, drafts: role('drafts'), inbox: role('inbox') }
}

const out = []
const say = s => { console.log(s); out.push(s) }
const j = v => JSON.stringify(v)

async function draft(a, subject) {
  const [[, res]] = await a.call([['Email/set', { accountId: a.accountId, create: { d: {
    mailboxIds: { [a.drafts]: true }, keywords: { $draft: true, $seen: true }, subject,
    from: [{ email: a.user }], to: [{ email: a.user }],
    bodyValues: { t: { value: subject } }, textBody: [{ partId: 't', type: 'text/plain' }],
  } } }, '0']])
  return res.created.d.id
}

async function submit(a, subject, parameters) {
  const emailId = await draft(a, subject)
  const envelope = parameters === undefined ? undefined : { mailFrom: { email: a.user, parameters }, rcptTo: [{ email: a.user }] }
  const [[, res]] = await a.call([['EmailSubmission/set', { accountId: a.accountId, create: { s: { emailId, ...(envelope && { envelope }) } } }, '0']])
  return { at: Date.now(), res, created: res.created?.s, error: res.notCreated?.s }
}

async function inboxHas(a, subject) {
  const [[, q]] = await a.call([['Email/query', { accountId: a.accountId, filter: { inMailbox: a.inbox, subject } }, '0']])
  return (q.ids ?? []).length > 0
}

async function arrival(a, subject, since, max = 40) {
  for (let i = 0; i < max; i += 1) {
    if (await inboxHas(a, subject)) return `delivered to INBOX ${Math.round((Date.now() - since) / 1000)} s after the submission`
    await sleep(1000)
  }
  return `not in INBOX after ${max} s`
}

async function run() {
  const a = await account('alice')
  say(`0. session accountCapabilities["${SUBMISSION}"]: ${j(a.session.accounts[a.accountId].accountCapabilities[SUBMISSION])}`)

  say('1. EmailSubmission/set create, envelope.mailFrom.parameters {"holdFor": "20"}')
  const s1 = await submit(a, 'hold-20', { holdFor: '20' })
  say(`   submitted at ${new Date(s1.at).toISOString()}, response: ${j(s1.res)}`)
  const id = s1.created?.id
  say(`   created keys: ${Object.keys(s1.created ?? {}).join(', ')} (RFC 8620 §5.3: all server-set properties, so also threadId, undoStatus)`)

  say(`2. right after: EmailSubmission/set update {"${id}": {"undoStatus": "canceled"}}`)
  const [[n2, r2]] = await a.call([['EmailSubmission/set', { accountId: a.accountId, update: { [id]: { undoStatus: 'canceled' } } }, '0']])
  say(`   response: ${n2} ${j(r2)}`)
  say(`   "${id}" in updated: ${id in (r2.updated ?? {})}, in notUpdated: ${id in (r2.notUpdated ?? {})}`)
  for (const [method, args] of [
    ['EmailSubmission/get', { ids: [id] }],
    ['EmailSubmission/changes', { sinceState: r2.newState ?? s1.res.newState }],
    ['EmailSubmission/query', {}],
    ['EmailSubmission/set', { destroy: [id] }],
  ]) {
    const [[name, res]] = await a.call([[method, { accountId: a.accountId, ...args }, '0']])
    say(`   ${method} ${j(args)}: ${name} ${j(res)}`)
  }
  say(`3. ${await arrival(a, 'hold-20', s1.at)} (sendAt announced: ${s1.created?.sendAt})`)

  say('4. other parameters')
  const s0 = await submit(a, 'no-hold', undefined)
  say(`   no envelope (control): ${j(s0.created ?? s0.error)}; ${await arrival(a, 'no-hold', s0.at, 10)}`)
  for (const [label, params] of [
    ['holdFor "86400"', { holdFor: '86400' }],
    ['holdFor "86401"', { holdFor: '86401' }],
    ['HOLDFOR "30" (RFC 4865 keyword)', { HOLDFOR: '30' }],
  ]) {
    const s = await submit(a, `p-${label}`, params)
    say(`   ${label}: ${s.created ? `created, sendAt ${s.created.sendAt}` : `notCreated ${j(s.error)}`}`)
  }
  const until = new Date(Date.now() + 15_000).toISOString().replace(/\.\d+Z$/, 'Z')
  const su = await submit(a, 'hold-until', { holdUntil: until })
  say(`   holdUntil "${until}": ${su.created ? `created, sendAt ${su.created.sendAt}` : `notCreated ${j(su.error)}`}; ${await arrival(a, 'hold-until', su.at, 30)}`)

  say(`5. EmailSubmission/set create + onSuccessUpdateEmail keyed by the existing submission id "${id}"`)
  const emailId = await draft(a, 'on-success-existing')
  const [[n5, r5]] = await a.call([['EmailSubmission/set', { accountId: a.accountId, create: { s: { emailId } }, onSuccessUpdateEmail: { [id]: { 'keywords/$seen': true } } }, '0']])
  say(`   response: ${n5} ${j(r5)}`)
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
# TMail memory backend for the email-submission-undo-send repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18420  JMAP
#   127.0.0.1:18421  WebAdmin
name: tmailbug-email-submission-undo-send

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18420:80'
      - '127.0.0.1:18421:8000'
```
`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18420
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```
`docker-compose.rabbitmq.yaml`:

```yaml
# Control on the mail queue of the distributed image (RabbitMQMailQueue), run with the postgresql
# image plus RabbitMQ (no Cassandra/OpenSearch needed). Same ports and jmap.properties as
# docker-compose.yaml. The postgresql image ships no /root/conf/keystore: reuse the memory one:
#   docker run --rm --entrypoint cat linagora/tmail-backend:memory-1.0.21.2 /root/conf/keystore > keystore
#   COMPOSE=docker-compose.rabbitmq.yaml node repro.mjs linagora/tmail-backend:postgresql-1.0.21.2
name: tmailbug-email-submission-undo-send

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
  rabbitmq:
    image: rabbitmq:3.13.3-management
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', '-q', 'ping']
      interval: 3s
      retries: 40
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:postgresql-1.0.21.2}
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
      - ./keystore:/root/conf/keystore:ro
      - ./rabbitmq.properties:/root/conf/rabbitmq.properties:ro
    ports:
      - '127.0.0.1:18420:80'
      - '127.0.0.1:18421:8000'
```
`rabbitmq.properties`:

```properties
# Switches the postgresql image to the RabbitMQ event bus and mail queue (RabbitMQMailQueue), as
# the distributed image uses. guest/guest is the default account of the throwaway rabbitmq
# container of docker-compose.rabbitmq.yaml (not published on the host).
uri=amqp://rabbitmq:5672
management.uri=http://rabbitmq:15672
management.user=guest
management.password=guest
mailqueue.view.sliceWindow=1h
mailqueue.view.bucketCount=1
mailqueue.view.updateBrowseStartPace=1000
mailqueue.size.metricsEnabled=false
task.consumption.enabled=true
address.contact.uri=amqp://rabbitmq:5672
address.contact.user=guest
address.contact.password=guest
address.contact.queue=AddressContactQueue1
```
</details>

### Expected result

Either the server supports delayed sending and canceling (`maxDelayedSend` > 0, `FUTURERELEASE` advertised, `undoStatus: "pending"`, cancel works), or it does not, and then: the delay parameters are rejected (or at least `sendAt` is the creation time), `undoStatus` is `"final"`, an update to `"canceled"` lands in `notUpdated` (`cannotUnsend`, or `notFound` since the object is not kept), and `/get`, `/changes`, `/query` answer as standard methods over an empty set.

**Actual:**

| step | `memory-1.0.21.2` | `memory-branch-master` | `postgresql-1.0.21.2` + RabbitMQ queue |
|---|---|---|---|
| 0. session, `urn:ietf:params:jmap:submission` | `maxDelayedSend: 0`, `submissionExtensions: {}` | same | same |
| 1. create with `holdFor: "20"` | created, `{id, sendAt: now+20s}` (no `undoStatus`, no `threadId`) | same | same |
| 2. update `undoStatus: "canceled"` | **no `updated`, no `notUpdated`** (= success) | same | same |
| 2. `EmailSubmission/get`, `/changes`, `/query` | `unknownMethod` | same | same |
| 2. `EmailSubmission/set destroy` | **ignored, no `destroyed`/`notDestroyed`** | same | same |
| 3. delivery of the "canceled" email | **delivered after 20 s** | **after 20 s** | **after 1 s** while `sendAt` said +20 s |
| 4. no envelope (control) | delivered after 1 s | same | same |
| 4. `holdFor: "86400"` | created, `sendAt` +24 h | same | created, `sendAt` +24 h, **delivered at once** |
| 4. `holdFor: "86401"` | `invalidArguments` "Invalid delayed time!" | same | same |
| 4. `HOLDFOR: "30"` | `invalidArguments` "Unsupported parameterName" | same | same |
| 4. `holdUntil` = now + 15 s | created, delivered after 15 s | same | created, **delivered after 1 s** |
| 5. `onSuccessUpdateEmail` keyed by the submission id of step 1 | `invalidArguments` "storage for EmailSubmission is not yet implemented" | same | same |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (2026-09-30), `linagora/tmail-backend:memory-branch-master` (built 2026-10-02), `linagora/tmail-backend:postgresql-1.0.21.2` with `postgres:16` and `rabbitmq:3.13.3-management` (`docker-compose.rabbitmq.yaml`, which also mounts the memory image's test keystore since the postgresql image ships none). Image configuration, except `jmap.properties` (Basic auth) and, for the last column, `rabbitmq.properties`. `delay.sends.enabled` is unset (default `false`) in all three images.
- The distributed image itself was not run; it uses the same `RabbitMQMailQueue` (log line above).

### Additional information

**Suggested fix**

1. (James, cheap, as proposed in JAMES-3543) Parse `update` and `destroy` in `EmailSubmissionSetRequest` and answer every id in `notUpdated` / `notDestroyed` with `notFound` (the object is not kept), or `cannotUnsend` for an `undoStatus` update. Register `EmailSubmission/get` (all ids in `notFound`), `/changes` (no change, or `cannotCalculateChanges`) and `/query` (empty), so that the advertised capability holds.
2. (James) Return `undoStatus: "final"` and `threadId` in `created`.
3. (James) Make `validateDelay` use what the capability advertises: when `delay.sends.enabled=false` (`maxDelayedSend: 0`), reject `holdFor`/`holdUntil` (SetError `invalidProperties`, `properties: ["envelope"]`), or at least ignore them and return `sendAt` = creation time. Compare parameter names case-insensitively.
4. (James / TMail configuration) Do not advertise nor accept delayed sends on a queue that drops delays (`RabbitMQMailQueue`): either fail `enqueueReactive(mail, delay)` with a positive delay, or let `SubmissionCapabilityFactory` know whether the queue supports delays. Otherwise `delay.sends.enabled=true` on the distributed image would advertise a feature that sends immediately.
5. Real undo send (JAMES-3543 storage + `undoStatus: "pending"` + removing the mail from the queue on cancel) is a feature, out of the scope of this bug.

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`) offers no undo send. This was found while prototyping it: with `holdFor` the email is held, the cancel looks successful (no `notUpdated`), and the email leaves anyway. A client that trusts the response tells the user the email was canceled.
- tmail-flutter sends without delay parameters and does not cancel; not affected today. Any client adding "send later" on a production stack (RabbitMQ queue) would see its email leave immediately while `sendAt` says otherwise.

**Related:** [JAMES-3543](https://issues.apache.org/jira/browse/JAMES-3543) (EmailSubmission storage: `/get`, `/set` update+destroy, `/changes`), [JAMES-3822](https://issues.apache.org/jira/browse/JAMES-3822) (delayed sends, RFC 4865), the other `EmailSubmission/set` candidates found at the same time (`identityId` never checked; `forbiddenFrom`/`forbiddenMailFrom` swapped), #2685, #2686.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
