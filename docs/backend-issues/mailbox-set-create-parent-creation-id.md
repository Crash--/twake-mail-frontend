### Description of the bug

`Mailbox/set` `create` cannot create a parent and its child in the **same** call: a child whose `parentId` is the creation id of a mailbox created in the same `create` map (`"parentId": "#p"`) fails with **`serverFail`** ("For input string: \"#p\""), whatever the order of the two entries. It only works when the parent is created by an earlier method call of the request.

RFC 8620 §5.3:

> Some records may hold references to other records (foreign keys). That reference may be set (via create or update) in the same request as the referenced record is created. To do this, the client refers to the new record using its creation id prefixed with a "#". […] In the case of records with references to the same type, the server MUST order the creates and updates within a single method call so that creates happen before their creation ids are referenced by another create/update/destroy in the same call.

`Mailbox.parentId` is exactly such a same-type reference. Even if James chose not to support it, an unresolved reference should be a SetError of the RFC (`invalidProperties` with `properties: ["parentId"]`, or `notFound`), not `serverFail`.

#### Cause (James upstream, line numbers at james-project `9aac85900f`, the TMail submodule; identical on apache/james-project `master` today)

- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/routes/ProcessingContext.scala:128-145`: creation ids (`"#…"` strings anywhere in the arguments) are substituted **once, before the method runs**, from the ids created by the previous method calls. A `#p` created inside the same call is unknown at that time and is left as the string `"#p"` (lines 140-142).
- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/method/MailboxSetCreatePerformer.scala:95-108` creates the mailboxes one after the other and records each creation id in the processing context (`recordCreationIdInProcessingContext`, lines 122, 171-176), but `resolvePath` (lines 137-150) parses `parentId` with `mailboxIdFactory.fromString("#p")` without looking it up; the resulting `NumberFormatException` (memory ids are numbers; other backends throw on a non-UUID) falls into the catch-all of `asMailboxSetError` (lines 66-68) → `serverFail`.
- The create map is iterated in map order, so even resolving `#…` there would need the creates to be ordered parents first (RFC 8620 §5.3).

The contract test `MailboxSetMethodContract.createParentIdShouldAcceptCreationIdsWithinTheSameRequest` (line 2992) only covers two separate method calls.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-mailbox-set-create-parent-creation-id`, `127.0.0.1:18434` JMAP, `127.0.0.1:18435` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates `alice` and sends:

```json
["Mailbox/set", {"accountId": "…", "create": {"p": {"name": "A-parent"}, "c": {"name": "A-child", "parentId": "#p"}}}, "m"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro: Mailbox/set create cannot reference, as parentId, a mailbox created in the SAME
// Mailbox/set call ("#creationId"): the child fails with serverFail ("For input string: \"#p\"").
// RFC 8620 §5.3 requires the server to order the creates so that this works. It only works when the
// parent is created in an EARLIER method call.
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-mailbox-set-create-parent-creation-id,
// JMAP 127.0.0.1:18434, WebAdmin 127.0.0.1:18435), creates the user alice, then:
//   A. one Mailbox/set: create {p: {name: "A-parent"}, c: {name: "A-child", parentId: "#p"}}
//   B. same, child listed first: create {c: {..., parentId: "#p"}, p: {...}}
//   C. control: two Mailbox/set calls in one request, the second with parentId "#p"
// and lists the resulting mailboxes.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18434'
const W = process.env.WA ?? 'http://127.0.0.1:18435'
const PROJECT = 'tmailbug-mailbox-set-create-parent-creation-id'
const USING = ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail']
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
  return { user, accountId, call }
}

const out = []
const say = s => { console.log(s); out.push(s) }
const j = v => JSON.stringify(v)

async function tree(a, prefix) {
  const [[, got]] = await a.call([['Mailbox/get', { accountId: a.accountId, properties: ['name', 'parentId'] }, '0']])
  const name = id => got.list.find(m => m.id === id)?.name
  return got.list.filter(m => m.name.startsWith(prefix)).map(m => (m.parentId ? `${name(m.parentId)} > ${m.name}` : m.name)).sort().join(', ')
}

async function run() {
  const a = await account('alice')
  const show = (label, responses) => {
    say(label)
    for (const [name, res, id] of responses) say(`  ${id} ${name}: created ${j(Object.keys(res.created ?? {}))}, notCreated ${j(res.notCreated ?? null)}`)
  }
  show('A. one Mailbox/set, create {p: {name: "A-parent"}, c: {name: "A-child", parentId: "#p"}}', await a.call([
    ['Mailbox/set', { accountId: a.accountId, create: { p: { name: 'A-parent' }, c: { name: 'A-child', parentId: '#p' } } }, 'm'],
  ]))
  say(`  mailboxes: ${await tree(a, 'A-')}`)
  show('B. one Mailbox/set, child listed first: create {c: {name: "B-child", parentId: "#p"}, p: {name: "B-parent"}}', await a.call([
    ['Mailbox/set', { accountId: a.accountId, create: { c: { name: 'B-child', parentId: '#p' }, p: { name: 'B-parent' } } }, 'm'],
  ]))
  say(`  mailboxes: ${await tree(a, 'B-')}`)
  show('C. control: two Mailbox/set calls in one request, the second one with parentId "#p"', await a.call([
    ['Mailbox/set', { accountId: a.accountId, create: { p: { name: 'C-parent' } } }, 'm1'],
    ['Mailbox/set', { accountId: a.accountId, create: { c: { name: 'C-child', parentId: '#p' } } }, 'm2'],
  ]))
  say(`  mailboxes: ${await tree(a, 'C-')}`)
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
# TMail memory backend for the mailbox-set-create-parent-creation-id repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18434  JMAP
#   127.0.0.1:18435  WebAdmin
name: tmailbug-mailbox-set-create-parent-creation-id

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18434:80'
      - '127.0.0.1:18435:8000'
```
`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18434
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```
</details>

### Expected result

Both mailboxes are created, `A-child` under `A-parent`.

**Actual** (identical on both images):

| case | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|
| A. one `Mailbox/set`, parent then child (`parentId: "#p"`) | parent created; child **`serverFail`** "For input string: \"#p\"" | same |
| B. one `Mailbox/set`, child listed first | parent created; child **`serverFail`** | same |
| C. control: two `Mailbox/set` calls in one request | both created, child under parent | same |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (2026-09-30), `linagora/tmail-backend:memory-branch-master` (built 2026-10-02). Image configuration, except `jmap.properties` (Basic auth).
- Backend-independent code; on backends with UUID mailbox ids the exception differs but ends in the same catch-all (not run).

### Additional information

**Suggested fix** (James, `MailboxSetCreatePerformer`): before creating, sort the `create` entries so that a mailbox whose `parentId` is `#x` comes after the creation `x` (reject cycles and unknown references with `invalidProperties`, `properties: ["parentId"]`), and resolve `#x` through the processing context updated by the previous creates instead of parsing it as an id. Map any `parentId` that cannot be parsed or found to `invalidProperties` / `notFound` rather than `serverFail`.

**Impact on clients**

- Twake Mail web and tmail-flutter create one folder per request today: not affected.
- Any client that creates a folder tree in one call (import, "move to new folder > subfolder", provisioning tools) gets a `serverFail` for every child, and must split its request.

**Related:** [JAMES-3354](https://issues.apache.org/jira/browse/JAMES-3354) (Mailbox/set creation: parentId handling), [JAMES-3356](https://issues.apache.org/jira/browse/JAMES-3356) (reusing creationId), the `x-` role candidate found at the same time, #2685, #2686.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
