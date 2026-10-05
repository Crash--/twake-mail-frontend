### Description of the bug

`EmailRecoveryAction` and the deleted messages vault capability (`com:linagora:params:jmap:messages:vault`) do not match their documentation, `docs/modules/ROOT/pages/tmail-backend/jmap-extensions/deletedMessagesVault.adoc` (the reference for this extension, which has no RFC):

1. **`maxEmailRecoveryPerRequest` is a string.** The session advertises `{"maxEmailRecoveryPerRequest": "5", "restorationHorizon": "15 days"}`; section "Additions to the capability object" (line 18) documents *"`maxEmailRecoveryPerRequest`: *Number | null*, defaulting to `5`"*.
2. **A finished action has status `completed`, documented `done`.** Section "EmailRecoveryAction object" (lines 42-48) lists `waiting`, `inProgress`, `done`, `failed`, `canceled`. The server sends James' task statuses, so `completed` instead of `done`; James also has `canceledRequested` (between a cancel request and its effect), not documented either (possible from the code, not observed in this run). `canceled` matches.
3. **`/get` and `/set` answers carry neither `accountId` nor `state`.** The doc calls them *"Standard `/get` methods"* (line 54) and *"Standard `/set` methods"* (line 61), i.e. RFC 8620 §5.1 (`accountId`, `state`, `list`, `notFound`) and §5.3 (`accountId`, `oldState`, `newState`, ...). Observed: `EmailRecoveryAction/get` answers `{"list", "notFound"}`, `EmailRecoveryAction/set` answers `{"created"}` / `{"updated"}` / `{"notUpdated"}` only. The methods ignore the `accountId` of the request: it is accepted, and optional (`/get` without it measured; `/set` by the code and the doc's examples). The doc's own examples omit `accountId` too, so the doc contradicts itself.

Smaller doc points in the same file:
- line 6: restored emails go into *"`Restored-messages` mailboxes"*: the default folder is `Restored-Messages`, and its JMAP `role` is `restored messages` (James `mailbox/api/src/main/java/org/apache/james/mailbox/Role.java:45-46`, added by JAMES-2790), which is not documented anywhere although clients need it to find the folder (it is not an IANA mailbox attribute, RFC 8621 §2 `role`);
- line 78: the example's `using` has `com:linagora:params:messages:vault`, the server advertises `com:linagora:params:jmap:messages:vault`;
- lines 88-89: `"hasAttachment": "true"` (a string, the property is `Boolean | null`) and `"suject"`.

#### Cause (TMail, line numbers at tmail-backend `7cf9131`; James at `9aac85900f`)

- `tmail-backend/jmap/extensions/src/main/scala/com/linagora/tmail/james/jmap/method/MessageVaultCapability.scala:34`: `"maxEmailRecoveryPerRequest" -> maxEmailRecoveryPerRequest.toString`.
- `json/EmailRecoveryActionSerializer.scala:88`: `statusWrites = status => JsString(status.getValue)`, the James `TaskManager.Status` values (`server/task/task-api/src/main/java/org/apache/james/task/TaskManager.java:29-35`: `waiting`, `inProgress`, `canceledRequested`, `completed`, `canceled`, `failed`).
- `model/EmailRecoveryAction.scala:126-134` (`EmailRecoveryActionSetRequest` / `...SetResponse` `extends WithoutAccountId`), `:197-198` (`EmailRecoveryActionGetRequest extends WithoutAccountId`), `:217-218` (`EmailRecoveryActionGetResponse(list, notFound)`); `method/EmailRecoveryActionGetMethod.scala:43` and `method/EmailRecoveryActionSetMethod.scala:108` are `MethodWithoutAccountId`.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` with the vault enabled (compose project `tmailbug-email-recovery-action-model`, `127.0.0.1:18448` JMAP, `127.0.0.1:18449` WebAdmin; mounts `jmap.properties` for Basic auth because the image's JWT key files are missing, `deletedMessageVault.properties` and a `listeners.xml` with the vault's pre-deletion hook), creates `alice` through WebAdmin, then:

1. reads the vault capability;
2. creates 3 emails in Inbox and destroys them (`Email/set destroy`);
3. `EmailRecoveryAction/set create {"subject": "recover me"}`, polls `EmailRecoveryAction/get` until a final status, prints both answers and their keys, then tries to cancel the finished action;
4. creates a second action, cancels it at once, then cancels it again;
5. `Mailbox/get` (name, role) and `Mailbox/query` by role.

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties, deletedMessageVault.properties, listeners.xml</summary>

`repro.mjs`:

```js
// Repro (com:linagora:params:jmap:messages:vault): EmailRecoveryAction and the vault capability
// deviate from the model documented in docs/.../jmap-extensions/deletedMessagesVault.adoc:
//  - `maxEmailRecoveryPerRequest` is a JSON string ("5"), documented `Number | null`;
//  - a finished action has status `completed`, documented `done` (and James' intermediate
//    `canceledRequested` can leak, undocumented);
//  - EmailRecoveryAction/get and /set answers carry neither `accountId` nor `state` /
//    `oldState` / `newState`, although the doc calls them "standard" /get and /set (RFC 8620 §5.1, §5.3).
// Also records what the restored emails' mailbox looks like in Mailbox/get (role / name) and how
// Mailbox/query `filter.role` treats that role and the standard ones.
//
//   node repro.mjs [image ...]     default: both memory images below
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail with the deleted messages vault enabled (compose project
// tmailbug-email-recovery-action-model, JMAP 127.0.0.1:18448, WebAdmin 127.0.0.1:18449,
// deletedMessageVault.properties + listeners.xml mounted), creates alice, then:
//   1. reads the vault capability;
//   2. creates 3 emails in Inbox and destroys them (Email/set destroy -> vault);
//   3. EmailRecoveryAction/set create, polls EmailRecoveryAction/get until the status is final,
//      printing the keys of both answers and every status seen;
//   4. a second action cancelled at once, then cancelled again;
//   5. Mailbox/get (name, role of every mailbox) and Mailbox/query by role.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT = 'tmailbug-email-recovery-action-model'
const J = process.env.JMAP ?? 'http://127.0.0.1:18448'
const W = process.env.WA ?? 'http://127.0.0.1:18449'
const D = 'example.com'
const IMAGES = ['linagora/tmail-backend:memory-1.0.21.2', 'linagora/tmail-backend:memory-branch-master']
const VAULT = 'com:linagora:params:jmap:messages:vault'

const sh = (cmd, env = {}) => execSync(cmd, { cwd: DIR, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).toString()
const compose = (image, args) => sh(`docker compose -p ${PROJECT} -f docker-compose.yaml ${args}`, { TMAIL_IMAGE: image })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const j = v => JSON.stringify(v)

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
  // Every capability the server advertises (core, mail, submission, James and Linagora extensions)
  const using = Object.keys(session.capabilities).filter(c => /^(urn:ietf:|urn:apache:james:|com:linagora:)/.test(c))
  const call = async methodCalls => {
    const r = await fetch(`${J}/jmap`, { method: 'POST', headers, body: JSON.stringify({ using, methodCalls }) })
    return (await r.json()).methodResponses
  }
  return { user, accountId, call, session, headers }
}


async function run(image) {
  const out = []
  const say = s => { console.log(s); out.push(s) }
  if (!process.env.NO_STACK) await startStack(image)
  await wa('PUT', `/domains/${D}`)
  const a = await account('alice')
  say(`image ${image}`)

  const cap = a.session.capabilities[VAULT]
  say('1. vault capability')
  say(`  session.capabilities["${VAULT}"] = ${j(cap)}`)
  say(`  typeof maxEmailRecoveryPerRequest = ${typeof cap?.maxEmailRecoveryPerRequest}  (documented: Number | null)`)
  say(`  "com:linagora:params:messages:vault" (capability of the doc's example) advertised: ${'com:linagora:params:messages:vault' in a.session.capabilities}`)

  const [[, mbx]] = await a.call([['Mailbox/get', { accountId: a.accountId, properties: ['name', 'role'] }, 'm']])
  const inbox = mbx.list.find(m => m.role === 'inbox').id
  const create = Object.fromEntries([1, 2, 3].map(i => [`e${i}`, {
    mailboxIds: { [inbox]: true }, subject: `recover me ${i}`, from: [{ email: 'bob@example.org' }], to: [{ email: a.user }],
    bodyValues: { t: { value: 'x' } }, textBody: [{ partId: 't', type: 'text/plain' }],
  }]))
  const [[, created]] = await a.call([['Email/set', { accountId: a.accountId, create }, 'c']])
  const ids = Object.values(created.created).map(e => e.id)
  const [[, destroyed]] = await a.call([['Email/set', { accountId: a.accountId, destroy: ids }, 'd']])
  say(`2. ${ids.length} emails created in Inbox, Email/set destroy -> destroyed ${destroyed.destroyed?.length ?? 0}`)

  const keys = o => j(Object.keys(o))
  const recoverySet = async args => (await a.call([['EmailRecoveryAction/set', args, 's']]))[0]
  const recoveryGet = async (id, extra = {}) => (await a.call([['EmailRecoveryAction/get', { ids: [id], ...extra }, 'g']]))[0]

  say('3. EmailRecoveryAction/set create (request with accountId, as RFC 8620 §5.3 requires)')
  let [name, res] = await recoverySet({ accountId: a.accountId, create: { r1: { subject: 'recover me' } } })
  say(`  answer: ${name} ${j(res)}`)
  say(`  keys of the answer: ${keys(res)}  (standard /set: accountId, oldState, newState, created, ...)`)
  const r1 = res.created?.r1?.id
  const seen = []
  let last
  for (let i = 0; i < 150; i += 1) {
    ;[name, last] = await recoveryGet(r1, { accountId: a.accountId })
    const status = last.list?.[0]?.status
    if (status !== seen.at(-1)) seen.push(status)
    if (['completed', 'done', 'failed', 'canceled'].includes(status)) break
    await new Promise(r => setTimeout(r, 200))
  }
  say(`  EmailRecoveryAction/get (with accountId) polled: statuses seen ${j(seen)}  (documented: waiting, inProgress, done, failed, canceled)`)
  say(`  last answer: ${name} ${j(last)}`)
  say(`  keys of the answer: ${keys(last)}  (standard /get: accountId, state, list, notFound)`)
  ;[name, res] = await recoveryGet(r1)
  say(`  EmailRecoveryAction/get without accountId: ${name} ${j(res)}`)
  ;[name, res] = await recoverySet({ accountId: a.accountId, update: { [r1]: { status: 'canceled' } } })
  say(`  cancel the finished action: ${name} ${j(res)}`)

  say('4. second action, cancelled right away')
  ;[name, res] = await recoverySet({ accountId: a.accountId, create: { r2: {} } })
  const r2 = res.created?.r2?.id
  ;[name, res] = await recoverySet({ accountId: a.accountId, update: { [r2]: { status: 'canceled' } } })
  say(`  cancel: ${name} ${j(res)}`)
  const seen2 = []
  for (let i = 0; i < 50; i += 1) {
    const [, g] = await recoveryGet(r2, { accountId: a.accountId })
    const status = g.list?.[0]?.status
    if (status !== seen2.at(-1)) seen2.push(status)
    if (['completed', 'done', 'failed', 'canceled'].includes(status)) break
    await new Promise(r => setTimeout(r, 100))
  }
  say(`  statuses seen after the cancel: ${j(seen2)}`)
  ;[name, res] = await recoverySet({ accountId: a.accountId, update: { [r2]: { status: 'canceled' } } })
  say(`  cancel again: ${name} ${j(res)}`)

  say('5. mailbox of the restored emails')
  const [[, mbx2]] = await a.call([['Mailbox/get', { accountId: a.accountId, properties: ['name', 'role', 'totalEmails'] }, 'm']])
  for (const m of mbx2.list) say(`  Mailbox/get  name ${j(m.name).padEnd(20)} role ${j(m.role ?? null).padEnd(20)} totalEmails ${m.totalEmails}`)
  const roles = ['restored messages', 'Restored-Messages', 'inbox', 'INBOX', 'sent', 'Sent', 'trash', 'Trash', 'templates', 'Templates']
  for (const role of roles) {
    const [[qn, q]] = await a.call([['Mailbox/query', { accountId: a.accountId, filter: { role } }, 'q']])
    const names = qn === 'error' ? `error ${j(q)}` : j(q.ids.map(id => mbx2.list.find(m => m.id === id)?.name))
    say(`  Mailbox/query {role: ${j(role)}}`.padEnd(48) + `-> ${names}`)
  }
  return out
}

const images = process.argv.slice(2).length ? process.argv.slice(2) : IMAGES
for (const image of images) {
  try {
    const out = await run(image)
    writeFileSync(`${DIR}/results-${image.split(':').pop()}.txt`, out.join('\n') + '\n')
  } finally {
    if (!process.env.NO_STACK) compose(image, 'down -v')
  }
}
```

`docker-compose.yaml`:

```yaml
# TMail memory backend for the EmailRecoveryAction model repro. Started by repro.mjs.
# jmap.properties is mounted for Basic auth (the image's JWT key files are missing).
# deletedMessageVault.properties and listeners.xml enable the deleted messages vault.
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18448  JMAP
#   127.0.0.1:18449  WebAdmin
name: tmailbug-email-recovery-action-model

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
      - ./deletedMessageVault.properties:/root/conf/deletedMessageVault.properties:ro
      - ./listeners.xml:/root/conf/listeners.xml:ro
    ports:
      - '127.0.0.1:18448:80'
      - '127.0.0.1:18449:8000'
```

`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18448
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```

`deletedMessageVault.properties`:

```properties
# Enables the deleted messages vault (disabled in the image). Restored emails go to "Restored-Messages".
enabled=true
restoreLocation=Restored-Messages
```

`listeners.xml`:

```xml
<?xml version="1.0"?>
<!-- The image's listeners.xml plus the pre-deletion hook that feeds the deleted messages vault. -->
<listeners>
    <executeGroupListeners>true</executeGroupListeners>
    <preDeletionHook>
        <class>org.apache.james.vault.DeletedMessageVaultHook</class>
    </preDeletionHook>
</listeners>
```

</details>

### Expected result

What the doc says, or a doc that says what the server does: a numeric `maxEmailRecoveryPerRequest`, the documented status names, and `accountId` + `state` in the answers of methods documented as standard.

**Actual** (`results-memory-1.0.21.2.txt`, `results-memory-branch-master.txt`, identical except generated ids):

| | documented | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|---|
| capability `maxEmailRecoveryPerRequest` | Number, `5` | **`"5"` (string)** | **`"5"`** |
| statuses seen while polling the first action | `waiting`, `inProgress`, `done` | `inProgress`, **`completed`** (3 restored) | `inProgress`, **`completed`** |
| status after an immediate cancel | `canceled` | `canceled` | `canceled` |
| cancel again / cancel a completed action | `invalidStatus` | `invalidStatus` | `invalidStatus` |
| keys of `EmailRecoveryAction/get` | `accountId`, `state`, `list`, `notFound` | **`list`, `notFound`** | **same** |
| keys of `EmailRecoveryAction/set` | `accountId`, `oldState`, `newState`, `created`… | **`created`** | **same** |
| restored folder in `Mailbox/get` | "`Restored-messages`", role not documented | name `Restored-Messages`, role `restored messages` | same |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (image created 2026-09-30), `linagora/tmail-backend:memory-branch-master` (created 2026-10-02). Image configuration except `jmap.properties` (Basic auth) and the vault (disabled in the image).
- The code is shared by every flavour; only memory was run.
- No existing issue found (`gh search issues --repo linagora/tmail-backend "EmailRecoveryAction"`: #680, #681, #893, #2192, all closed and about other points; nothing for `maxEmailRecoveryPerRequest`).

### Additional information

**Suggested fix**

Both clients already rely on what the server sends, so the safe direction differs per point:

1. Status names: **fix the doc** (`completed` instead of `done`, and mention `canceledRequested`). Renaming `completed` to `done` on the server would break tmail-flutter (`email_recovery/lib/email_recovery/email_recovery_status.dart.dart`, enum `waiting, inProgress, completed, failed, canceled`) and Twake Mail web (`common/src/features/recovery/RecoveryProvider.tsx:90`).
2. `maxEmailRecoveryPerRequest`: send a number (`MessageVaultCapability.scala:34`, drop `.toString`). Safe for both clients: tmail-flutter does not read it, and `jmap-client-ts` already types it `number | string | null` (`src/linagora/capabilities.ts:63-68`).
3. `accountId` / `state`: add `accountId` (the request's, or the user's when absent) to both answers and a `state` / `newState` (additive, clients ignore unknown keys), and accept `accountId` in requests. Do **not** make it mandatory yet: tmail-flutter sends none (`email_recovery/lib/email_recovery/get/get_email_recovery_action_method.dart:15` `GetMethodNoNeedAccountId`, `set/set_email_recovery_action_method.dart:9` `SetMethodNoNeedAccountId`). Or, if tasks are not meant to have states, document these methods as non-standard on that point and fix the examples.
4. Document the `restored messages` role of the restore folder (and the real folder name `Restored-Messages`), and fix the capability name and the example typos.

**Impact on clients**

- Twake Mail web works around all of it: `jmap-client-ts` types (`src/linagora/types/emailRecovery.ts:7` "`completed`, not the `done` of the extension's documentation", `:46` and `:67` "tmail-backend sends neither `accountId` nor `state`", `src/linagora/capabilities.ts:63-68` "tmail-backend sends it as a string"), and the app finds the restored folder by the undocumented role (`common/src/features/recovery/RecoveryProvider.tsx:32-33`, `RESTORED_ROLE = 'restored messages'`).
- tmail-flutter uses `completed` and finds the folder through `Mailbox/query {"role": "Restored-Messages"}` (`lib/features/email/domain/usecases/get_restored_deleted_message_interactor.dart:31-36`): the folder *name*, which only works because James' `Mailbox/query` role filter matches default folder names instead of roles (separate candidate `mailbox-query-role-filter`; step 5 of this repro shows `{"role": "restored messages"}` rejected and `{"role": "Restored-Messages"}` accepted).
- A new client written from the doc would wait forever for `done`, and fail to parse the capability if it expects a number.

**Related:** #2682, #2684, #2685, #2686 (other issues found while building Twake Mail web on the memory image); `mailbox-query-role-filter` (candidate: `Mailbox/query` role filter); `mailbox-templates-role` (candidate on another non-IANA role, `templates`); JAMES-2790 (role of `Restored-Messages`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
