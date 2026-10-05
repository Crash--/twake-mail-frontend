### Description of the bug

`Forward/set` (`com:linagora:params:jmap:forward`) only accepts an update that carries **both** `localCopy` and `forwards`. A patch with one of them is rejected with `invalidArguments` "Missing '/localCopy' property" (or "Missing '/forwards' property"), and an empty patch too.

The extension documents `Forward/set` as *"a standard `/set` method"* (`docs/modules/ROOT/pages/tmail-backend/jmap-extensions/forwards.adoc`, section "Forward/set"), so `update` takes a PatchObject (RFC 8620 §5.3): *"A PatchObject [...] represents an unordered set of patches"*; properties that are not in it keep their value, and *"This patch definition is designed such that an entire Foo object is also a valid PatchObject. The client may choose to optimise network usage by just sending the diff or may send the whole object"*. Today only the whole object works.

#### Cause (TMail, line numbers at tmail-backend `7cf9131`)

- `tmail-backend/jmap/extensions/src/main/scala/com/linagora/tmail/james/jmap/model/ForwardSet.scala:42-45`: the patch is parsed with `ForwardSerializer.deserializeForwardSetUpdateRequest` into `ForwardUpdateRequest(localCopy: LocalCopy, forwards: Seq[Forward])` (lines 93-94), both mandatory.
- `json/ForwardSerializer.scala:49`: `Json.reads[ForwardUpdateRequest]`, hence "Missing '/localCopy' property".
- `method/ForwardSetMethod.scala:77-94`: the new mapping list is computed from the patch only (`getForwards` adds the user itself when `localCopy` is true), never from the current state.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-forward-set-partial-patch`, `127.0.0.1:18442` JMAP, `127.0.0.1:18443` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates `alice` through WebAdmin, then sends `Forward/set` updates on `singleton` and reads `Forward/get` after each one.

```json
["Forward/set", {"accountId": "…", "update": {"singleton": {"forwards": ["carol@example.org"]}}}, "u"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro: Forward/set (com:linagora:params:jmap:forward) rejects every update patch that does not
// carry both `localCopy` and `forwards`, although the extension documents a "standard /set" and
// RFC 8620 §5.3 makes a PatchObject a set of changes (absent properties stay as they are).
//
//   node repro.mjs [image ...]     default: both memory images below
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-forward-set-partial-patch,
// JMAP 127.0.0.1:18442, WebAdmin 127.0.0.1:18443), creates alice, then sends Forward/set
// updates on "singleton" and reads Forward/get after each one:
//   1. both properties (control);  2. `forwards` only;  3. `localCopy` only;
//   4. the whole object as returned by Forward/get (with "id": RFC 8620 §5.3 says an entire
//      object is a valid PatchObject);  5. an empty patch;  6. both properties again (control).
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT = 'tmailbug-forward-set-partial-patch'
const J = process.env.JMAP ?? 'http://127.0.0.1:18442'
const W = process.env.WA ?? 'http://127.0.0.1:18443'
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

  const get = async () => {
    const [[, res]] = await a.call([['Forward/get', { accountId: a.accountId, ids: ['singleton'] }, 'g']])
    return res.list[0]
  }
  const patch = async (label, p) => {
    const [[name, res]] = await a.call([['Forward/set', { accountId: a.accountId, update: { singleton: p } }, 'u']])
    const answer = name === 'error' ? `error ${j(res)}`
      : res.updated?.singleton !== undefined ? `updated ${j(res.updated.singleton)}`
        : `notUpdated ${j(res.notUpdated?.singleton)}`
    say(label)
    say(`  patch        ${j(p)}`)
    say(`  Forward/set  -> ${answer}`)
    say(`  Forward/get  -> ${j(await get())}`)
  }

  say(`initial Forward/get -> ${j(await get())}`)
  await patch('1. control: both properties', { localCopy: true, forwards: ['bob@example.org'] })
  await patch('2. forwards only (expected: forwards replaced, localCopy stays true)', { forwards: ['carol@example.org'] })
  await patch('3. localCopy only (expected: localCopy false, forwards unchanged)', { localCopy: false })
  await patch('4. whole object as read by Forward/get', await get())
  await patch('5. empty patch (expected: no-op, updated)', {})
  await patch('6. control: both properties again', { localCopy: true, forwards: ['bob@example.org', 'carol@example.org'] })
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
# TMail memory backend for the Forward/set partial patch repro. Started by repro.mjs.
# jmap.properties is mounted for Basic auth (the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18442  JMAP
#   127.0.0.1:18443  WebAdmin
name: tmailbug-forward-set-partial-patch

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18442:80'
      - '127.0.0.1:18443:8000'
```

`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18442
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```

</details>

### Expected result

Each patch changes only what it carries: `{"forwards": [...]}` replaces the list and keeps `localCopy`; `{"localCopy": false}` keeps the list; `{}` is a no-op answered `updated`.

**Actual** (`results-memory-1.0.21.2.txt`, `results-memory-branch-master.txt`, identical):

| patch on `singleton` | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|
| 1. `{"localCopy": true, "forwards": ["bob@…"]}` (control) | `updated` | `updated` |
| 2. `{"forwards": ["carol@…"]}` | **`notUpdated` `invalidArguments` "Missing '/localCopy' property"** | **same** |
| 3. `{"localCopy": false}` | **`notUpdated` `invalidArguments` "Missing '/forwards' property"** | **same** |
| 4. the whole object as returned by `Forward/get` (with `"id": "singleton"`) | `updated` | `updated` |
| 5. `{}` | **`notUpdated` "Missing '/localCopy' property"** | **same** |

`Forward/get` confirms that nothing changed after 2, 3 and 5.

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (image created 2026-09-30), `linagora/tmail-backend:memory-branch-master` (created 2026-10-02). Image configuration except `jmap.properties` (Basic auth).
- The code is shared by every flavour (the forwards are RecipientRewriteTable mappings); only memory was run.
- No existing issue found (`gh search issues --repo linagora/tmail-backend "Forward localCopy"`).

### Additional information

**Suggested fix (TMail)**

Parse the patch with both properties optional (`localCopy: Option[LocalCopy]`, `forwards: Option[Seq[Forward]]`, unknown properties still refused, `id` accepted only if it is `"singleton"`), read the current `Forward` (same code as `Forward/get`: current mappings, `localCopy` = the user is among them) and fill the missing ones from it before computing the diff in `ForwardSetMethod.update`. Add contract cases to `LinagoraForwardSetMethodContract` for `forwards` only, `localCopy` only and `{}`.

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`) works around it by always sending both properties (`common/src/features/forward/queries.ts:33-36`: "Both properties go every time: tmail-backend refuses a patch without `localCopy`"). With the fix it could send only the toggled checkbox, without the risk of overwriting a list changed meanwhile from another client.
- tmail-flutter sends the whole `TMailForward` object (`forward/lib/forward/set/set_forward_method.dart`, `OptionalUpdateSingleton`), so it is not affected.

**Related:** #2682, #2684, #2685, #2686 (other issues found while building Twake Mail web on the memory image); `identity-set-null-replyto-bcc` and `label-set-color-null-and-changes-state` (candidates: other `/set` updates that do not follow the PatchObject semantics of RFC 8620 §5.3).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
