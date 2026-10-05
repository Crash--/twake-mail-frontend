### Description of the bug

`EmailSubmission/set` `create` returns the two "forbidden sender" SetErrors of RFC 8621 the wrong way round:

- the **From / Sender header** of the email uses an address the user may not send from → James answers **`forbiddenMailFrom`**, which RFC 8621 §7.5 reserves for the **envelope** (`MAIL FROM`);
- the **envelope** `mailFrom` uses such an address → James answers **`forbiddenFrom`** (with `properties: ["envelope.mailFrom"]`), which RFC 8621 §7.5 reserves for the **From header**.

RFC 8621 §7.5, extra SetError types for `create`:

> o "forbiddenMailFrom" - The server does not permit the user to send a message with the envelope From address [RFC5321].
>
> o "forbiddenFrom" - The server does not permit the user to send a message with the From header field [RFC5322] of the message to be sent.

(also registered as two distinct codes in §10.6.10 and §10.6.11). The ticket that introduced the method, [JAMES-3434](https://issues.apache.org/jira/browse/JAMES-3434), describes the right mapping ("The FROM field of the envelope needs to belong to the sender. In which case it fails with `forbiddenMailFrom`. The FROM field of the EML needs to belong to the sender. In which case it fails with `forbiddenFrom`."); the implementation swapped them, and the contract tests pin the swapped names.

A related detail: an email **without any From header** is answered `forbiddenFrom` ("MimeMessage From is missing"). The user is not forbidden anything; the message is invalid (RFC 5322 §3.6 requires From), which is what `invalidEmail` (RFC 8621 §7.5, with `properties: ["from"]`) is for.

#### Cause (James upstream, line numbers at james-project `9aac85900f`, the TMail submodule; identical on apache/james-project `master` today)

`server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/method/EmailSubmissionSetMethod.scala`:

- `validate` (lines 461-484): the From/Sender **header** addresses the user cannot use raise `ForbiddenMailFromException` (lines 462-469); an **envelope** `mailFrom` the user cannot use raises `ForbiddenFromException` (lines 473-475). The exception names are already swapped.
- `CreationFailure.asSetError` (lines 94-106) serialises them as named: `ForbiddenMailFromException` → `forbiddenMailFrom` with the description "MimeMessage From and Sender fields not allowed", `ForbiddenFromException` → `forbiddenFrom` with "envelope From not allowed" and `properties: ["envelope.mailFrom"]`, `ForbiddenHeaderFromException` (no From header, line 398) → `forbiddenFrom`.
- Contract tests asserting the current names: `server/protocols/jmap-rfc-8621-integration-tests/jmap-rfc-8621-integration-tests-common/src/main/scala/org/apache/james/jmap/rfc8621/contract/EmailSubmissionSetMethodContract.scala`, `setShouldRejectOtherUserUsageInSenderMimeField` (line 1844), `setShouldRejectOtherUserUsageInFromMimeField` (1901), `setShouldRejectWhenMissingFromMimeField` (1956), `setShouldRejectOtherUserUsageInFromEnvelopeField` (2013).

TMail's `Email/send` (`tmail-backend/jmap/extensions/src/main/scala/com/linagora/tmail/james/jmap/method/EmailSendMethod.scala:251-274`) copies the same `validate`, and `EmailSendResults.notCreated` (`model/EmailSend.scala:220-226`) maps both exceptions to `serverFail` (not tested here: `Email/send` requires `com:linagora:params:jmap:pgp`, which the memory image does not advertise).

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-email-submission-forbidden-from-swapped`, `127.0.0.1:18422` JMAP, `127.0.0.1:18423` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates the user `alice@example.com`; `ghost@example.com` does not exist (no user, no alias), so alice may not send as ghost. Each case creates a draft with `Email/set`, then submits it with `EmailSubmission/set`; every recipient is alice herself, and no forbidden case sends anything.

Request of case B:

```json
["EmailSubmission/set", {"accountId": "…", "create": {"s": {"emailId": "…",
  "envelope": {"mailFrom": {"email": "ghost@example.com"}, "rcptTo": [{"email": "alice@example.com"}]}}}}, "0"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro: EmailSubmission/set create swaps the two SetError types of RFC 8621 §7.5:
//   - a From/Sender HEADER the user may not use is answered "forbiddenMailFrom" (envelope error);
//   - an ENVELOPE mailFrom the user may not use is answered "forbiddenFrom" (header error).
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-email-submission-forbidden-from-swapped,
// JMAP 127.0.0.1:18422, WebAdmin 127.0.0.1:18423), creates the user alice. ghost@example.com does
// not exist (no user, no alias), so alice may not send as ghost. All recipients are alice herself.
//   A. From: ghost, no envelope                         RFC: forbiddenFrom
//   B. From: alice, envelope.mailFrom ghost              RFC: forbiddenMailFrom
//   C. From: alice, Sender: ghost, no envelope           RFC: forbiddenFrom
//   D. control: From: alice, envelope.mailFrom alice     created
//   E. no From header, envelope.mailFrom alice           RFC: invalidEmail (the message is invalid)
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18422'
const W = process.env.WA ?? 'http://127.0.0.1:18423'
const PROJECT = 'tmailbug-email-submission-forbidden-from-swapped'
const USING = ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail', 'urn:ietf:params:jmap:submission']
const D = 'example.com'
const GHOST = `ghost@${D}`

const sh = (cmd, env = {}) => execSync(cmd, { cwd: DIR, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).toString()
const compose = (image, args) => sh(`docker compose -p ${PROJECT} -f docker-compose.yaml ${args}`, { TMAIL_IMAGE: image })
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
  return { user, accountId, call, drafts: role('drafts') }
}

const out = []
const say = s => { console.log(s); out.push(s) }
const j = v => JSON.stringify(v)

const emailOf = (a, headers, subject) => ({
  mailboxIds: { [a.drafts]: true }, keywords: { $draft: true, $seen: true }, subject, to: [{ email: a.user }], ...headers,
  bodyValues: { t: { value: subject } }, textBody: [{ partId: 't', type: 'text/plain' }],
})

async function submission(a, label, expected, headers, mailFrom) {
  const [[, set]] = await a.call([['Email/set', { accountId: a.accountId, create: { d: emailOf(a, headers, label) } }, '0']])
  const emailId = set.created?.d?.id
  if (!emailId) return say(`${label}: draft not created ${j(set.notCreated)}`)
  const envelope = mailFrom && { mailFrom: { email: mailFrom }, rcptTo: [{ email: a.user }] }
  const [[name, res]] = await a.call([['EmailSubmission/set', { accountId: a.accountId, create: { s: { emailId, ...(envelope && { envelope }) } } }, '0']])
  const got = name !== 'EmailSubmission/set' ? `${name} ${j(res)}` : res.created?.s ? 'created' : j(res.notCreated?.s)
  const type = res.created?.s ? 'created' : res.notCreated?.s?.type
  say(`${label}\n  expected (RFC 8621 §7.5): ${expected}\n  actual: ${got}  -> ${type === expected ? 'OK' : 'WRONG'}`)
}


async function run() {
  const a = await account('alice')
  await submission(a, 'A. From: ghost, no envelope', 'forbiddenFrom', { from: [{ email: GHOST }] })
  await submission(a, 'B. From: alice, envelope.mailFrom ghost', 'forbiddenMailFrom', { from: [{ email: a.user }] }, GHOST)
  await submission(a, 'C. From: alice, Sender: ghost, no envelope', 'forbiddenFrom', { from: [{ email: a.user }], sender: [{ email: GHOST }] })
  await submission(a, 'D. control: From: alice, envelope.mailFrom alice', 'created', { from: [{ email: a.user }] }, a.user)
  await submission(a, 'E. no From header, envelope.mailFrom alice', 'invalidEmail', {}, a.user)
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
# TMail memory backend for the email-submission-forbidden-from-swapped repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18422  JMAP
#   127.0.0.1:18423  WebAdmin
name: tmailbug-email-submission-forbidden-from-swapped

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18422:80'
      - '127.0.0.1:18423:8000'
```
`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18422
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```
</details>

### Expected result

| case | expected (RFC 8621 §7.5) | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|---|
| A. From: ghost, no envelope | `forbiddenFrom` | **`forbiddenMailFrom`** | **`forbiddenMailFrom`** |
| B. From: alice, envelope `mailFrom` ghost | `forbiddenMailFrom` | **`forbiddenFrom`**, `properties: ["envelope.mailFrom"]` | **`forbiddenFrom`** |
| C. From: alice, Sender: ghost, no envelope | `forbiddenFrom` | **`forbiddenMailFrom`** | **`forbiddenMailFrom`** |
| D. control: From alice, envelope `mailFrom` alice | created | created | created |
| E. no From header, envelope `mailFrom` alice | `invalidEmail` (`properties: ["from"]`) | **`forbiddenFrom`** | **`forbiddenFrom`** |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (2026-09-30), `linagora/tmail-backend:memory-branch-master` (built 2026-10-02). Image configuration, except `jmap.properties` (Basic auth).
- The code path is the same for every backend (the check uses `CanSendFrom`); not run on the distributed or postgresql images.

### Additional information

**Suggested fix** (James):

1. In `EmailSubmissionSetMethod.validate`, raise the header exception for From/Sender and the envelope exception for `envelope.mailFrom` (or simply swap the two `SetErrorType`s in `asSetError`, keeping `properties: ["envelope.mailFrom"]` on `forbiddenMailFrom` and adding `properties: ["from"]` / `["sender"]` on `forbiddenFrom`). Update the four contract tests above.
2. Answer a missing From header with `invalidEmail` and `properties: ["from"]`.
3. TMail `Email/send`: map the two exceptions like `EmailSubmission/set` does instead of `serverFail`.

This is a visible change of error codes: clients that only know one of them (see below) need to handle both, which they should do anyway per RFC 8621.

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`, `common/src/features/composer/composeEmail.ts:481-486`) maps both `forbiddenFrom` and `forbiddenMailFrom` to the same "you cannot send from this address" message, with a comment saying tmail-backend answers `forbiddenMailFrom` instead of `forbiddenFrom`: no change needed after the fix.
- tmail-flutter sends an explicit envelope whose `mailFrom` is the From address (`lib/features/email/data/network/email_api.dart:207-225`), so a forbidden From is reported as `forbiddenMailFrom` (the header check runs first); it handles neither code specifically and shows a generic error.
- Other JMAP clients that follow the RFC show the wrong message (e.g. "change your From" for an envelope problem).

**Related:** [JAMES-3434](https://issues.apache.org/jira/browse/JAMES-3434) (original specification of these errors), the other `EmailSubmission/set` candidates found at the same time (`identityId` never checked; undo send / `maxDelayedSend`), #2685, #2686.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
