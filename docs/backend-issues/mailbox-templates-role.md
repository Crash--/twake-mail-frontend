### Description of the bug

James derives a mailbox's `role` from its name (documented: "Role are based on the name of the mailbox", `server/protocols/jmap-rfc-8621/doc/specs/spec/mail/mailbox.mdown:25-27`). Besides the known names (`INBOX`, `Sent`, `Drafts`, `Trash`, `Archive`, `Spam`, `Outbox`, `Templates`, `Restored-Messages`), **any top-level folder whose name starts with `x-`** gets that name as a "custom" role, and `Mailbox/set` then refuses to rename or destroy it as a system mailbox. A user who creates a folder `x-files` (or `x-perso`, `x-old`…) can never rename nor delete it through JMAP:

```
Mailbox/set create {name: "x-custom"}          -> created; Mailbox/get: role "x-custom"
Mailbox/set update {name: "x-custom2"}         -> invalidArguments "Invalid change to a system mailbox"
Mailbox/set destroy                            -> invalidArguments "System mailboxes cannot be destroyed"
```

`x-custom` is not a valid JMAP role either: RFC 8621 §2, `role`: "The value MUST be one of the Mailbox attribute names listed in the IANA "IMAP Mailbox Name Attributes" registry […] converted to lowercase."

The same name rule makes a user-created top-level `Templates` folder a system mailbox (role `templates`, sortOrder 80, cannot be renamed nor destroyed). That one is intended (TMail's templates provisioning and tmail-flutter rely on the `Templates` name, `DefaultMailboxes.TEMPLATES`), even though `templates` is not in the IANA registry either (nor are `outbox` and `restored messages`; `Spam` is correctly exposed as `junk`). Only `Templates` with this exact case gets it: `templates`, `Modèles`, or `Parent/Templates` get no role, and renaming a folder to `Templates` gives it the role. The client can neither set nor change a role (`invalidArguments` "Some server-set properties were specified" / "Can not modify server-set properties"), which is [JAMES-3530](https://issues.apache.org/jira/browse/JAMES-3530) (open) — RFC 8621 does not mark `role` as server-set.

This issue is about the `x-` prefix only: the rest is documented behaviour, listed for context.

#### Cause (James upstream, line numbers at james-project `9aac85900f`, the TMail submodule; identical on apache/james-project `master` today)

- `mailbox/api/src/main/java/org/apache/james/mailbox/Role.java:67-87`: `Role.from(name)` returns a predefined role (name comparison, case-sensitive except INBOX), else `tryBuildCustomRole`, which returns `new Role(name)` for **any name starting with `x-`** (`USER_DEFINED_ROLE_PREFIX`). `isSystemRole()` (line 89-91) is `false` for such a custom role.
- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/mail/MailboxFactory.scala:81-82`: the JMAP `role` is `Role.from(mailboxPath.getName)` (full path name, so only top-level folders match).
- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/method/MailboxSetUpdatePerformer.scala:296-297` and `MailboxSetDeletePerformer.scala:148`: `isASystemMailbox` is `Role.from(name).isPresent`, i.e. true for custom `x-` roles too, while `Mailbox.hasSystemRole` (`mail/Mailbox.scala:142`) correctly uses `isSystemRole`.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-mailbox-templates-role`, `127.0.0.1:18430` JMAP, `127.0.0.1:18431` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates `alice`, lists the provisioned mailboxes, creates `Templates`, `templates`, `Modèles`, `Parent`, `Parent > Templates`, `x-custom`, tries to set or clear a role, to rename and destroy `Templates` and `x-custom`; then a second user renames `Modèles` to `Templates`.

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Documents how tmail-backend (James) gives mailbox roles: from the mailbox NAME, only at the top
// level. A folder a user names "Templates" gets the "templates" role (not in the IANA registry
// RFC 8621 §2 points to), becomes a system mailbox (cannot be renamed nor destroyed), and the
// client can neither set nor change a role (JAMES-3530).
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-mailbox-templates-role,
// JMAP 127.0.0.1:18430, WebAdmin 127.0.0.1:18431), creates the user alice, then:
//   1. Mailbox/get of the provisioned mailboxes (name, role, sortOrder);
//   2. Mailbox/set create "Templates", "templates", "Modèles", "Parent" > "Templates",
//      "x-custom" and reads their role;
//   3. Mailbox/set create {name: "My templates", role: "templates"} and
//      update "Modèles" {role: "templates"};
//   4. Mailbox/set update "Templates" {name: "Templates (old)"}, then destroy it (same for "x-custom");
//   5. a second user renames a folder "Modèles" to "Templates": does it get the role?
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18430'
const W = process.env.WA ?? 'http://127.0.0.1:18431'
const PROJECT = 'tmailbug-mailbox-templates-role'
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

async function list(a) {
  const [[, got]] = await a.call([['Mailbox/get', { accountId: a.accountId, properties: ['name', 'parentId', 'role', 'sortOrder'] }, '0']])
  return got.list
}
const describe = (m, all) => `${all.find(p => p.id === m.parentId)?.name ? `${all.find(p => p.id === m.parentId).name} > ` : ''}${m.name}: role ${j(m.role ?? '(missing)')}, sortOrder ${m.sortOrder}`

async function set(a, args) {
  const [[name, res]] = await a.call([['Mailbox/set', { accountId: a.accountId, ...args }, '0']])
  return name === 'Mailbox/set' ? res : { error: res }
}

async function run() {
  const a = await account('alice')
  say('1. provisioned mailboxes')
  const initial = await list(a)
  for (const m of initial) say(`   ${describe(m, initial)}`)

  say('2. Mailbox/set create, then Mailbox/get')
  const created = await set(a, { create: {
    templates: { name: 'Templates' }, lower: { name: 'templates' }, fr: { name: 'Modèles' }, parent: { name: 'Parent' }, custom: { name: 'x-custom' },
  } })
  if (created.notCreated) say(`   notCreated: ${j(created.notCreated)}`)
  const ids = Object.fromEntries(Object.entries(created.created ?? {}).map(([k, v]) => [k, v.id]))
  const child = await set(a, { create: { nested: { name: 'Templates', parentId: ids.parent } } })
  if (child.notCreated) say(`   notCreated: ${j(child.notCreated)}`)
  ids.nested = child.created?.nested?.id
  const after = await list(a)
  for (const key of ['templates', 'lower', 'fr', 'nested', 'custom']) {
    const m = after.find(x => x.id === ids[key])
    say(`   ${m ? describe(m, after) : `${key}: not created`}`)
  }

  say('3. setting a role from the client')
  const withRole = await set(a, { create: { r: { name: 'My templates', role: 'templates' } } })
  say(`   create {name: "My templates", role: "templates"}: ${j(withRole.created ?? withRole.notCreated ?? withRole)}`)
  const updRole = await set(a, { update: { [ids.fr]: { role: 'templates' } } })
  say(`   update "Modèles" {role: "templates"}: ${j(updRole.updated ?? updRole.notUpdated ?? updRole)}`)
  const updNull = await set(a, { update: { [ids.templates]: { role: null } } })
  say(`   update "Templates" {role: null}: ${j(updNull.updated ?? updNull.notUpdated ?? updNull)}`)

  say('4. the user-created "Templates" is now a system mailbox')
  const rename = await set(a, { update: { [ids.templates]: { name: 'Templates (old)' } } })
  say(`   update {name: "Templates (old)"}: ${j(rename.updated ?? rename.notUpdated ?? rename)}`)
  const destroy = await set(a, { destroy: [ids.templates] })
  say(`   destroy: ${j(destroy.destroyed ?? destroy.notDestroyed ?? destroy)}`)
  const lowerDestroy = await set(a, { destroy: [ids.lower] })
  say(`   control, destroy "templates" (lower case, no role): ${j(lowerDestroy.destroyed ?? lowerDestroy.notDestroyed ?? lowerDestroy)}`)
  const customRename = await set(a, { update: { [ids.custom]: { name: 'x-custom2' } } })
  say(`   "x-custom" update {name: "x-custom2"}: ${j(customRename.updated ?? customRename.notUpdated ?? customRename)}`)
  const customDestroy = await set(a, { destroy: [ids.custom] })
  say(`   "x-custom" destroy: ${j(customDestroy.destroyed ?? customDestroy.notDestroyed ?? customDestroy)}`)

  say('5. second user: rename "Modèles" to "Templates"')
  const b = await account('bob')
  const bc = await set(b, { create: { fr: { name: 'Modèles' } } })
  const frId = bc.created.fr.id
  const br = await set(b, { update: { [frId]: { name: 'Templates' } } })
  say(`   update {name: "Templates"}: ${j(br.updated ?? br.notUpdated ?? br)}`)
  const bl = await list(b)
  say(`   ${describe(bl.find(m => m.id === frId), bl)}`)
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
# TMail memory backend for the mailbox-templates-role repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18430  JMAP
#   127.0.0.1:18431  WebAdmin
name: tmailbug-mailbox-templates-role

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18430:80'
      - '127.0.0.1:18431:8000'
```
`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18430
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```
</details>

### Expected result

A folder named `x-custom` is an ordinary user folder: `role: null`, renamable and destroyable.

**Actual** (identical on both images):

| step | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|
| provisioned | INBOX `inbox`, Sent `sent`, Archive `archive`, Drafts `drafts`, Outbox `outbox`, Trash `trash`, Spam `junk` | same |
| create `x-custom` | **role `x-custom`** | same |
| rename / destroy `x-custom` | **rejected: system mailbox** | same |
| create `Templates` (top level) | role `templates`, sortOrder 80 (intended) | same |
| rename / destroy `Templates` | rejected: system mailbox (intended) | same |
| create `templates`, `Modèles`, `Parent > Templates` | no role (`role` missing, see the null-properties candidate) | same |
| rename `Modèles` → `Templates` | role `templates` | same |
| create `{name: "My templates", role: "templates"}` | `invalidArguments` "Some server-set properties were specified" (JAMES-3530) | same |
| update `{role: "templates"}` / `{role: null}` | `invalidArguments` "Can not modify server-set properties" (JAMES-3530) | same |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (2026-09-30), `linagora/tmail-backend:memory-branch-master` (built 2026-10-02). Image configuration, except `jmap.properties` (Basic auth).
- Name-based, backend-independent code; not run on the distributed or postgresql images.

### Additional information

**Suggested fix** (James): in `MailboxSetUpdatePerformer.isASystemMailbox` and `MailboxSetDeletePerformer.isASystemMailbox`, use `Role.from(name).filter(Role::isSystemRole).isPresent`; and stop exposing `x-…` names as JMAP roles in `MailboxFactory.getRole` (keep `Role.from` for `Mailbox/query` filters if needed). The long-term fix for roles (annotations, client-settable roles, IANA values) is JAMES-3530.

**Impact on clients**

- Twake Mail web and tmail-flutter: a user folder named `x-…` cannot be renamed nor deleted, and shows a role the client does not know.
- Twake Mail web creates `Templates` itself on the first "Save as template" (as tmail-flutter does) and relies on the server giving it the `templates` role; that part must stay.

**Related:** [JAMES-3530](https://issues.apache.org/jira/browse/JAMES-3530) (role not settable), [JAMES-4040](https://issues.apache.org/jira/browse/JAMES-4040) (`spam` → `junk`), the `restored messages` role and the null-properties candidates found at the same time, #2682.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
