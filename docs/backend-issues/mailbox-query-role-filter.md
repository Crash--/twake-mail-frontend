### Description of the bug

`Mailbox/query` with `filter.role` rejects the role values that `Mailbox/get` returns, and accepts default **folder names** instead:

- `{"role": "sent"}`, `"drafts"`, `"trash"`, `"archive"`, `"outbox"`, `"junk"`, `"templates"`, `"restored messages"` → method error `invalidArguments` "'/filter/role' property is not valid: sent is not a valid role";
- `{"role": "Sent"}`, `"Drafts"`, `"Trash"`, `"Archive"`, `"Outbox"`, `"Spam"`, `"Restored-Messages"` → the matching mailbox;
- only `"inbox"` works both ways (`INBOX` is compared case-insensitively).

RFC 8621 §2.3 (`Mailbox/query`), FilterCondition: *"role: String|null — The Mailbox role property must match the given value exactly."* The role property is what `Mailbox/get` returns (`"sent"`, `"junk"`...). `{"role": null}` (mailboxes without a role) and an empty filter (all mailboxes) are rejected too.

#### Cause (James, line numbers at james-project `9aac85900f`, the TMail submodule)

- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/json/MailboxQuerySerializer.scala:36-39`: the filter value goes through `Role.from(value)`.
- `mailbox/api/src/main/java/org/apache/james/mailbox/Role.java:67-79`: `Role.from` → `predefinedRole(name)` compares the given string with each role's **default mailbox name** (`role.comparator.apply(role.defaultMailbox, name)`, line 78), not with the role name; only `x-` prefixed custom roles are built otherwise. It is the function `MailboxFactory` uses to derive a role from a folder name (`server/protocols/jmap-rfc-8621/.../mail/MailboxFactory.scala:81`), reused here for the opposite purpose.
- `json/MailboxSerializer.scala:54-57`: `Mailbox/get` writes `role.serialize()` (and `junk` for `Role.SPAM`), which `Role.from` does not recognise.
- `mail/MailboxQuery.scala:34`: `MailboxFilter(role: Role)`: `role` mandatory and non-null; `method/MailboxQueryMethod.scala:57` looks the mailbox up by its default name (`systemMailboxesProvider.getMailboxByRole`).

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-mailbox-query-role-filter`, `127.0.0.1:18452` JMAP, `127.0.0.1:18453` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates `alice` through WebAdmin, reads `Mailbox/get` (name, role), and for each mailbox runs `Mailbox/query` with `{"role": <its role>}` and `{"role": <its name>}`; then `"spam"`, `"templates"`, `"Templates"`, `null` and an empty filter.

```json
["Mailbox/query", {"accountId": "…", "filter": {"role": "sent"}}, "q"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro: Mailbox/query `filter.role` rejects the role values that Mailbox/get returns
// ("sent", "trash", "drafts", "archive", "junk", "outbox", "restored messages"...) with
// invalidArguments "<x> is not a valid role", and accepts the default *folder names* instead
// ("Sent", "Trash", "Spam", "Restored-Messages"). Only "inbox" works both ways (case-insensitive).
// RFC 8621 §2.3: "role: String|null — The Mailbox role property must match the given value exactly."
//
//   node repro.mjs [image ...]     default: both memory images below
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-mailbox-query-role-filter,
// JMAP 127.0.0.1:18452, WebAdmin 127.0.0.1:18453), creates alice, reads Mailbox/get (name, role),
// then for every mailbox runs Mailbox/query with {role: <its role>} and {role: <its name>};
// plus {role: "spam"}, {role: "templates"}, {role: null} and an empty filter.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT = 'tmailbug-mailbox-query-role-filter'
const J = process.env.JMAP ?? 'http://127.0.0.1:18452'
const W = process.env.WA ?? 'http://127.0.0.1:18453'
const D = 'example.com'
const IMAGES = ['linagora/tmail-backend:memory-1.0.21.2', 'linagora/tmail-backend:memory-branch-master']

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
  const [[, mbx]] = await a.call([['Mailbox/get', { accountId: a.accountId, properties: ['name', 'role'] }, 'm']])
  const nameOf = id => mbx.list.find(m => m.id === id)?.name ?? id
  const query = async filter => {
    const [[name, res]] = await a.call([['Mailbox/query', { accountId: a.accountId, filter }, 'q']])
    return name === 'error' ? `${res.type}: ${res.description}` : j(res.ids.map(nameOf))
  }
  say('Mailbox/get                          | Mailbox/query {role: <role>}            | Mailbox/query {role: <name>}')
  for (const m of mbx.list) {
    say(`${`name ${j(m.name)} role ${j(m.role)}`.padEnd(37)}| ${(await query({ role: m.role })).padEnd(40)}| ${await query({ role: m.name })}`)
  }
  for (const filter of [{ role: 'spam' }, { role: 'templates' }, { role: 'Templates' }, { role: null }, {}]) {
    say(`Mailbox/query filter ${j(filter)}`.padEnd(48) + `-> ${await query(filter)}`)
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
# TMail memory backend for the Mailbox/query role filter repro. Started by repro.mjs.
# jmap.properties is mounted for Basic auth (the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18452  JMAP
#   127.0.0.1:18453  WebAdmin
name: tmailbug-mailbox-query-role-filter

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18452:80'
      - '127.0.0.1:18453:8000'
```

`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18452
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```

</details>

### Expected result

`{"role": "sent"}` returns the mailbox whose `Mailbox/get` role is `sent`, and so on for every role (including `junk` and `restored messages`); a folder name is not a role.

**Actual** (`results-memory-1.0.21.2.txt`, `results-memory-branch-master.txt`, identical):

| `Mailbox/get` name / role | `{"role": <role>}` | `{"role": <name>}` |
|---|---|---|
| `INBOX` / `inbox` | `["INBOX"]` | `["INBOX"]` |
| `Sent` / `sent` | **`invalidArguments` "sent is not a valid role"** | `["Sent"]` |
| `Archive` / `archive` | **`invalidArguments`** | `["Archive"]` |
| `Drafts` / `drafts` | **`invalidArguments`** | `["Drafts"]` |
| `Outbox` / `outbox` | **`invalidArguments`** | `["Outbox"]` |
| `Trash` / `trash` | **`invalidArguments`** | `["Trash"]` |
| `Spam` / `junk` | **`invalidArguments`** | `["Spam"]` |
| `Restored-Messages` / `restored messages` (after a vault restore, see `email-recovery-action-model`) | **`invalidArguments`** | `["Restored-Messages"]` |
| `{"role": null}` / `{}` | **`invalidArguments`** | – |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (image created 2026-09-30), `linagora/tmail-backend:memory-branch-master` (created 2026-10-02). Image configuration except `jmap.properties` (Basic auth). The `Restored-Messages` row comes from the `email-recovery-action-model` repro (vault enabled), same images.
- The code is in James, shared by every flavour; only memory was run.
- JAMES-3547 (open, "Complete the implementation of Mailbox/query": only the `role` filter, no operators, no sort) is related but does not mention that the role filter expects folder names. Nothing found here.

### Additional information

**Suggested fix (James)**

Parse `filter.role` against the role names (`Role.serialize()`, plus `junk` for `SPAM`), e.g. a `Role.fromRoleName` used by `MailboxQuerySerializer`, and match the mailboxes on the role `Mailbox/get` would give them. tmail-flutter currently relies on the folder name (below), so for a transition the filter can accept the role name first and fall back on the default folder name. Supporting `role: null` and an empty filter belongs to JAMES-3547.

**Impact on clients**

- tmail-flutter finds the folder of restored emails with `Mailbox/query {"role": "Restored-Messages"}` (`lib/features/email/domain/usecases/get_restored_deleted_message_interactor.dart:31-36`, `lib/features/mailbox/data/network/mailbox_api.dart:569`), i.e. with the folder name, which works only because of this bug; a strict fix would break it, hence the transition above.
- Twake Mail web (`twake-mail-frontend`) does not use `Mailbox/query`: it reads all mailboxes and matches `role` locally (`common/src/features/recovery/RecoveryProvider.tsx:32-33`, `RESTORED_ROLE = 'restored messages'`).
- Any RFC-conformant client using the role filter (e.g. to find Sent or Drafts in one call) gets an error.

**Related:** #2682, #2684, #2685, #2686 (other issues found while building Twake Mail web on the memory image); `email-recovery-action-model` (candidate: the restore folder's role is undocumented); `mailbox-templates-role` (candidate on the `templates` role); JAMES-3547, JAMES-2790.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
