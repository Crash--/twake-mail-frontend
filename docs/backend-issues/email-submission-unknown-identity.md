### Description of the bug

`EmailSubmission/set` `create` never looks at `identityId`. An identity id that does not exist, the identity id of **another user**, or no `identityId` at all are all accepted, and the email is sent. RFC 8621 asks for an `invalidProperties` SetError:

- §7: `identityId: "Id" (immutable)` — "The id of the Identity to associate with this submission." It has no default, so the client must give it on creation (RFC 8620 §5.3: only properties with a default value "may be omitted by the client").
- §7.5: "If the Email or Identity id given cannot be found, the submission creation is rejected with a standard "invalidProperties" SetError."
- §7, envelope generation: "If the address found from this is not allowed by the Identity associated with this submission, the "email" property from the Identity MUST be used instead." — this needs the identity too.

The other half of the same sentence of §7.5 is not followed either: an `emailId` that cannot be found is rejected with a SetError of type **`invalidArguments`** (`properties: ["emailId"]`), and an `emailId` that is not a valid id for the backend with `invalidArguments` too. `invalidArguments` is a method-level error (RFC 8620 §3.6.2), not one of the SetError types of RFC 8620 §5.3 nor of §7.5; a client switching on SetError types does not recognise it.

James' annotated specification documents identityId as "Not implemented. Submissions cannot be created with identityId. This field should be omitted." (`server/protocols/jmap-rfc-8621/doc/specs/spec/mail/messagesubmission.mdown:13-14`), while the same file keeps the §7.5 sentence above (line 233). Clients do send it (tmail-flutter, Twake Mail web, every RFC client), and James silently ignores it.

#### Cause (James upstream, line numbers at james-project `9aac85900f`, the TMail submodule; identical on apache/james-project `master` today)

- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/mail/EmailSubmissionSet.scala:166-168`: `EmailSubmissionCreationRequest(emailId, identityId: Option[Id], envelope)`. `identityId` is parsed (and allowed by `assignableProperties`, line 154), then never read.
- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/method/EmailSubmissionSetMethod.scala:276-308` (`sendEmail`): loads the email, derives the envelope from the headers (`resolveEnvelope`, lines 486-500), checks the From/Sender and the envelope against `CanSendFrom` (`validate`, lines 461-484), and enqueues. No `IdentityRepository` lookup.
- Same file, `CreationFailure.asSetError`: `MessageNotFoundException` → `SetError(invalidArgumentValue, "The email to be sent cannot be found", ["emailId"])` (lines 107-111), parse errors → `EmailSubmissionCreationParseException` with `invalidArguments` (lines 87-89, 266-274). `SetError.invalidArgumentValue` is `"invalidArguments"` (`core/SetError.scala:31`).

The sender check itself is fine: whatever the identity, James only lets the user send from addresses `CanSendFrom` allows, so this is not a security issue. It is a conformance and robustness issue: a client cannot learn that the identity it used is gone (deleted from another device), and the identity's properties are never applied.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-email-submission-unknown-identity`, `127.0.0.1:18424` JMAP, `127.0.0.1:18425` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates `alice` and `bob`, reads their identities with `Identity/get`, then alice sends drafts From alice To alice (local delivery only) and the script checks whether each accepted submission reached alice's INBOX, with which From and Return-Path.

Request of case A:

```json
["EmailSubmission/set", {"accountId": "…", "create": {"s": {"emailId": "1", "identityId": "Iunknown0000"}}}, "0"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro: EmailSubmission/set create never looks at identityId (RFC 8621 §7, §7.5): an unknown
// identity, or another user's identity, is accepted and the email is sent; omitting it is accepted
// too. An unknown emailId is rejected with a SetError of type "invalidArguments" (not a SetError
// type of RFC 8620 §5.3) instead of "invalidProperties".
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-email-submission-unknown-identity,
// JMAP 127.0.0.1:18424, WebAdmin 127.0.0.1:18425), creates alice and bob, reads their identities
// (Identity/get), then alice sends drafts From: alice, To: alice (local delivery only) with:
//   A. identityId "Iunknown0000"                (well-formed, no such identity)
//   B. identityId = bob's identity id           (exists, but in another account)
//   C. identityId omitted                       (identityId has no default in RFC 8621 §7)
//   D. control: identityId = alice's identity
//   E. emailId "999999" with alice's identity (memory ids are numbers: well-formed, not found)
//   F. emailId "Munknown0000" with alice's identity (not even a valid memory id)
// and, for each accepted submission, whether the email reached alice's INBOX and with which
// From and Return-Path (the envelope MAIL FROM).
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18424'
const W = process.env.WA ?? 'http://127.0.0.1:18425'
const PROJECT = 'tmailbug-email-submission-unknown-identity'
const USING = ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail', 'urn:ietf:params:jmap:submission']
const D = 'example.com'

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
  const [[, mbx], [, ids]] = await call([['Mailbox/get', { accountId }, '0'], ['Identity/get', { accountId }, '1']])
  const role = r => mbx.list.find(m => m.role === r).id
  return { user, accountId, call, drafts: role('drafts'), inbox: role('inbox'), identities: ids.list }
}

const out = []
const say = s => { console.log(s); out.push(s) }
const j = v => JSON.stringify(v)

async function delivered(a, subject) {
  for (let i = 0; i < 10; i += 1) {
    const [[, q], [, g]] = await a.call([
      ['Email/query', { accountId: a.accountId, filter: { inMailbox: a.inbox, subject } }, 'q'],
      ['Email/get', { accountId: a.accountId, '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' }, properties: ['from', 'header:Return-Path:asText'] }, 'g'],
    ])
    if (q.ids?.length) { const e = g.list[0]; return `delivered to INBOX, From ${e.from?.map(x => x.email)}, Return-Path ${e['header:Return-Path:asText']}` }
    await sleep(1000)
  }
  return 'not delivered after 10 s'
}

// Short subjects: the memory image's Lucene does not find long subjects with Email/query.
async function submit(a, label, expected, { identityId, emailId } = {}) {
  let id = emailId
  const subject = `idcase-${label[0]}`
  if (!id) {
    const [[, set]] = await a.call([['Email/set', { accountId: a.accountId, create: { d: {
      mailboxIds: { [a.drafts]: true }, keywords: { $draft: true, $seen: true }, subject,
      from: [{ email: a.user }], to: [{ email: a.user }], bodyValues: { t: { value: label } }, textBody: [{ partId: 't', type: 'text/plain' }],
    } } }, '0']])
    id = set.created.d.id
  }
  const create = { s: { emailId: id, ...(identityId !== undefined && { identityId }) } }
  const [[name, res]] = await a.call([['EmailSubmission/set', { accountId: a.accountId, create }, '0']])
  const type = name !== 'EmailSubmission/set' ? `${name} ${j(res)}` : res.created?.s ? 'created' : res.notCreated?.s?.type
  say(`${label}\n  request: ${j(create.s)}\n  expected (RFC 8621 §7.5): ${expected}\n  actual: ${res.created?.s ? 'created' : j(res.notCreated?.s ?? res)}  -> ${type === expected ? 'OK' : 'WRONG'}`)
  if (res.created?.s && !emailId) say(`  ${await delivered(a, subject)}`)
}

async function run() {
  const alice = await account('alice')
  const bob = await account('bob')
  say(`alice Identity/get: ${j(alice.identities.map(i => ({ id: i.id, email: i.email })))}`)
  say(`bob   Identity/get: ${j(bob.identities.map(i => ({ id: i.id, email: i.email })))}`)
  await submit(alice, 'A. identityId "Iunknown0000" (no such identity)', 'invalidProperties', { identityId: 'Iunknown0000' })
  await submit(alice, "B. identityId = bob's identity", 'invalidProperties', { identityId: bob.identities[0].id })
  await submit(alice, 'C. identityId omitted', 'invalidProperties', {})
  await submit(alice, "D. control: identityId = alice's identity", 'created', { identityId: alice.identities[0].id })
  await submit(alice, 'E. emailId "999999" (well-formed for this backend, no such email)', 'invalidProperties', { identityId: alice.identities[0].id, emailId: '999999' })
  await submit(alice, 'F. emailId "Munknown0000" (not a valid id for this backend)', 'invalidProperties', { identityId: alice.identities[0].id, emailId: 'Munknown0000' })
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
# TMail memory backend for the email-submission-unknown-identity repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18424  JMAP
#   127.0.0.1:18425  WebAdmin
name: tmailbug-email-submission-unknown-identity

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18424:80'
      - '127.0.0.1:18425:8000'
```
`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18424
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```
</details>

### Expected result

| case | expected (RFC 8621 §7, §7.5) | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|---|
| A. `identityId` "Iunknown0000" (no such identity) | `invalidProperties` | **created, delivered** (From/Return-Path alice) | **created, delivered** |
| B. `identityId` = bob's identity | `invalidProperties` | **created, delivered** (From/Return-Path alice) | **created, delivered** |
| C. `identityId` omitted | `invalidProperties` | **created, delivered** | **created, delivered** |
| D. control: alice's identity | created | created, delivered | created, delivered |
| E. `emailId` "999999" (well-formed, no such email) | `invalidProperties` | **`invalidArguments`**, `properties: ["emailId"]` | **`invalidArguments`** |
| F. `emailId` "Munknown0000" (not a valid id here) | `invalidProperties` | **`invalidArguments`** ("'/emailId' property is not valid") | **`invalidArguments`** |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (2026-09-30), `linagora/tmail-backend:memory-branch-master` (built 2026-10-02). Image configuration, except `jmap.properties` (Basic auth).
- Same code path on every backend; not run on the distributed or postgresql images.

### Additional information

**Suggested fix** (James, `EmailSubmissionSetMethod.sendEmail`):

1. Resolve `identityId` against the user's identities (`IdentityRepository.list(username)`, already used by `Identity/get`); reject an unknown one with `invalidProperties`, `properties: ["identityId"]`. A missing `identityId` should be rejected the same way; if James wants to keep accepting old clients that omit it, document that leniency instead of "should be omitted".
2. When generating the envelope (`resolveEnvelope`), fall back to the identity's `email` when the From/Sender address is not allowed, as §7 requires (today the creation is rejected instead).
3. Answer an `emailId` that cannot be found or parsed with `invalidProperties`, `properties: ["emailId"]`, and use a SetError type of RFC 8620 §5.3 / RFC 8621 §7.5 everywhere `asSetError` currently uses `invalidArguments` (also for the `holdFor`/`holdUntil` errors).
4. Update `messagesubmission.mdown` (identityId is accepted, now validated).

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`, `common/src/features/composer/composeEmail.ts:531-534`) and tmail-flutter (`lib/features/email/data/network/email_api.dart:222-225`) always send the selected identity's id. If the identity was deleted on another device, the email still leaves without error, and nothing of the identity is applied server-side (both clients write From, Reply-To, Bcc and signature into the email themselves, so the visible effect is limited today).
- Clients that rely on the server to pick the envelope from the identity (§7) get a `forbiddenFrom`/`forbiddenMailFrom` instead.
- No security impact found: the From and envelope checks (`CanSendFrom`) apply whatever the identity.

**Related:** [JAMES-3434](https://issues.apache.org/jira/browse/JAMES-3434) (original `EmailSubmission/set` create, "IdentityId is not specified"), [JAMES-3543](https://issues.apache.org/jira/browse/JAMES-3543) (EmailSubmission storage), the other `EmailSubmission/set` candidates found at the same time (`forbiddenFrom`/`forbiddenMailFrom` swapped; undo send / `maxDelayedSend`), #2685, #2686.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
