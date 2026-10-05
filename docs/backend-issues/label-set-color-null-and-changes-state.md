### Description of the bug

The colour of a label cannot be removed. `Label/set` `update` with `{"color": null}` is rejected with `invalidArguments` "Expecting a JSON string as an argument" (`properties: ["color"]`), and the label keeps its colour.

The extension doc types the property as nullable: `docs/modules/ROOT/pages/tmail-backend/jmap-extensions/jmapLabels.adoc`, section "Label object": *"**color**: `Color`|null. Color of the label."*, and `Label/set` is a *"Standard /set method as described in Section 5.3, RFC8620"*, where a `null` patch value removes the property (RFC 8620 §5.3: *"If null, set to the default value if specified for this property; otherwise, remove the property from the patched object"*). The server itself accepts `color: null` at creation, and `description: null` (same `String|null` shape) on update.

#### Cause (TMail, line numbers at tmail-backend `7cf9131`)

- `tmail-backend/jmap/extensions/src/main/scala/com/linagora/tmail/james/jmap/model/LabelSet.scala:71-81` (`validateColor`): only a `JsString` is accepted; `JsNull` falls into "Expecting a JSON string as an argument". `validateDescription` right below (lines 83-91) maps `JsNull` to `DescriptionUpdate(None)`.
- The update path cannot express "remove the colour" anyway: `ValidatedLabelPatchObject.colorUpdate: Option[Color]` (lines 103-105) and `LabelRepository.updateLabel(..., newColor: Option[Color], ...)` (`jmap/extensions-api/.../label/LabelRepository.scala:34`), where `None` means "unchanged" (`MemoryLabelRepository.scala:58-64`: `color = newColor.orElse(oldLabel.color)`; same in `extensions-cassandra/.../CassandraLabelDAO.scala:151`, `extensions-postgres/.../PostgresLabelRepository.java:85`). The description got a dedicated `DescriptionUpdate(Option[String])` (`extensions-api/.../model/Label.scala:70`) for exactly this.
- The WebAdmin label route has the same limit (`webadmin/webadmin-jmap/.../label/LabelRoutes.java:120-132`: `body.color()` absent = unchanged).

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-label-set-color-null-and-changes-state`, `127.0.0.1:18444` JMAP, `127.0.0.1:18445` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates `alice` through WebAdmin, creates labels and updates them, printing the `Label/set` answer and `Label/get` after each step. It then sends `/changes` calls with states the server cannot use (see "For the record" below).

```json
["Label/set", {"accountId": "…", "update": {"<label id>": {"color": null}}}, "u"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro (com:linagora:params:jmap:labels):
//  - Label/set update refuses `color: null` ("Expecting a JSON string as an argument"), so the
//    colour of a label cannot be removed, although the doc types it `Color|null` and `null`
//    is accepted at creation and for `description`;
//  - Label/changes answers `invalidArguments` (not `cannotCalculateChanges`, RFC 8620 §5.2) to a
//    sinceState that is not a UUID; compared with an unknown UUID and with James' Mailbox/changes
//    and Email/changes on the same server.
//
//   node repro.mjs [image ...]     default: both memory images below
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-label-set-color-null-and-changes-state,
// JMAP 127.0.0.1:18444, WebAdmin 127.0.0.1:18445), creates alice, then runs the Label/set
// cases (answer + Label/get after each) and the /changes cases.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT = 'tmailbug-label-set-color-null-and-changes-state'
const J = process.env.JMAP ?? 'http://127.0.0.1:18444'
const W = process.env.WA ?? 'http://127.0.0.1:18445'
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
  say(`labels capability: ${j(a.session.capabilities['com:linagora:params:jmap:labels'])}`)

  const get = async id => {
    const [[, res]] = await a.call([['Label/get', { accountId: a.accountId, ids: [id] }, 'g']])
    const { displayName, color, description } = res.list[0] ?? {}
    // JSON.stringify drops undefined: a property missing from the Label/get answer is not shown
    return j({ displayName, color, description })
  }
  const create = async (label, value) => {
    const [[name, res]] = await a.call([['Label/set', { accountId: a.accountId, create: { c: value } }, 'c']])
    const id = res.created?.c?.id
    say(label)
    say(`  create      ${j(value)}`)
    say(`  Label/set   -> ${name === 'error' ? `error ${j(res)}` : id ? `created ${j(res.created.c)}` : `notCreated ${j(res.notCreated?.c)}`}`)
    if (id) say(`  Label/get   -> ${await get(id)}`)
    return id
  }
  const patch = async (label, id, p) => {
    const [[name, res]] = await a.call([['Label/set', { accountId: a.accountId, update: { [id]: p } }, 'u']])
    const answer = name === 'error' ? `error ${j(res)}`
      : res.updated && id in res.updated ? `updated ${j(res.updated[id])}`
        : `notUpdated ${j(res.notUpdated?.[id])}`
    say(label)
    say(`  patch       ${j(p)}`)
    say(`  Label/set   -> ${answer}`)
    say(`  Label/get   -> ${await get(id)}`)
  }

  say('-- Label/set')
  await create('1. control: create with color: null', { displayName: 'No colour', color: null })
  const red = await create('2. create with a colour and a description', { displayName: 'Red', color: '#ff0000', description: 'red one' })
  await patch('3. update color: null (expected: colour removed)', red, { color: null })
  await patch('4. control: update description: null', red, { description: null })
  await patch('5. control: update color to another colour', red, { color: '#00ff00' })

  say('-- /changes with a state the server cannot use')
  const garbage = 'not-a-state'
  const uuid = randomUUID()
  const changes = async (method, sinceState) => {
    const [[name, res]] = await a.call([[method, { accountId: a.accountId, sinceState }, 'ch']])
    return name === 'error' ? `error ${j(res)}` : `ok (created ${res.created.length}, updated ${res.updated.length}, destroyed ${res.destroyed.length})`
  }
  const [[, lg]] = await a.call([['Label/get', { accountId: a.accountId, ids: [] }, 'g']])
  say(`Label/get state: ${j(lg.state)}`)
  say(`Label/changes   sinceState = Label/get state  -> ${await changes('Label/changes', lg.state)}`)
  say(`Label/changes   sinceState = "${garbage}"     -> ${await changes('Label/changes', garbage)}`)
  say(`Label/changes   sinceState = random UUID      -> ${await changes('Label/changes', uuid)}`)
  for (const m of ['Mailbox/changes', 'Email/changes', 'Identity/changes']) {
    say(`${m.padEnd(15)} sinceState = "${garbage}"     -> ${await changes(m, garbage)}`)
    say(`${m.padEnd(15)} sinceState = random UUID      -> ${await changes(m, uuid)}`)
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
# TMail memory backend for the Label/set color null and Label/changes state repro. Started by repro.mjs.
# jmap.properties is mounted for Basic auth (the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18444  JMAP
#   127.0.0.1:18445  WebAdmin
name: tmailbug-label-set-color-null-and-changes-state

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18444:80'
      - '127.0.0.1:18445:8000'
```

`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18444
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```

</details>

### Expected result

`{"color": null}` is answered `updated` and `Label/get` then returns `"color": null`.

**Actual** (`results-memory-1.0.21.2.txt`, `results-memory-branch-master.txt`, identical except generated ids):

| case | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|
| 1. control: create `{"displayName": "No colour", "color": null}` | `created`, no colour | same |
| 2. create `{"displayName": "Red", "color": "#ff0000", "description": "red one"}` | `created` | same |
| 3. update `{"color": null}` | **`notUpdated` `invalidArguments` "Expecting a JSON string as an argument", colour still `#ff0000`** | **same** |
| 4. control: update `{"description": null}` | `updated`, description removed | same |
| 5. control: update `{"color": "#00ff00"}` | `updated` | same |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (image created 2026-09-30), `linagora/tmail-backend:memory-branch-master` (created 2026-10-02). Image configuration except `jmap.properties` (Basic auth). Labels capability `{"version": 2}`.
- The validation is shared by every flavour; only memory was run.
- No existing issue found (`gh search issues --repo linagora/tmail-backend "Label color"`: #702, the spec, closed).

### Additional information

**Suggested fix (TMail)**

Mirror `DescriptionUpdate`: a `ColorUpdate(value: Option[Color])`, `validateColor` mapping `JsNull` to `ColorUpdate(None)`, and `LabelRepository.updateLabel(..., newColor: Option[ColorUpdate], ...)` in the memory, Cassandra and Postgres implementations (Cassandra/Postgres: write `null`). Optionally let `LabelRoutes` (WebAdmin) remove a colour the same way. Add a `LabelSetMethodContract` case for `color: null`.

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`) offers "no colour" in its label dialog but has to drop `color` from the patch when the user picks it (`common/src/features/labels/LabelDialog.tsx:99-104`: "tmail-backend refuses a null colour: a colour cannot be taken off"), so the old colour silently stays.
- tmail-flutter always gives a label a colour and its `copyWith` keeps the previous one (`labels/lib/extensions/label_extension.dart:38-46`), so it does not try to remove one.

**For the record, not a bug: `Label/changes` with an unusable state.** Twake Mail web had noted that `Label/changes` answers `invalidArguments` "to a state it does not know" (`common/src/features/labels/queries.ts:81-85`). Measured: that only happens for a `sinceState` that is not a UUID (`'/sinceState' property is not valid: error.expected.uuid`); an unknown UUID gets `cannotCalculateChanges` (RFC 8620 §5.2). James' own `Mailbox/changes`, `Email/changes` and `Identity/changes` answer exactly the same way on the same server (both images), so `Label/changes` is consistent with the rest. RFC 8620 §5.2 defines `cannotCalculateChanges` as *"The server cannot calculate the changes from the state string given by the client"*, which arguably also covers a malformed state; changing that would be a James-wide decision (states are UUIDs in `UuidState`), not a Label one. Clients already reload everything on either error.

**Related:** #2682, #2684, #2685, #2686 (other issues found while building Twake Mail web on the memory image); `identity-set-null-replyto-bcc` and `forward-set-partial-patch` (candidates: other `/set` updates that do not follow the PatchObject semantics of RFC 8620 §5.3); `get-omits-null-properties` (candidate: `Label/get` omits `color`/`description` when they are `null`, seen in case 1).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
