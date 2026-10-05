### Description of the bug

`Identity/set` `update` does not follow the PatchObject semantics of RFC 8620 §5.3 on two points. Both are in James (`server/protocols/jmap-rfc-8621`, `server/data/data-jmap`), so every TMail flavour is affected:

1. **`null` is ignored.** A patch `{"replyTo": null, "bcc": null}` is answered `updated` but changes nothing: the previous Reply-To and Bcc stay. RFC 8621 §6 declares `replyTo: EmailAddress[]|null (default: null)` and `bcc: EmailAddress[]|null (default: null)`, and RFC 8620 §5.3 says of a patch value: *"If null, set to the default value if specified for this property"*. Same for `textSignature: null`, `htmlSignature: null` and `name: null` (RFC 8621 §6: `String`, `default: ""`): `updated`, nothing changes. Sending `[]` works, which is what clients do today.
2. **The first update of a server-provided identity drops what the patch does not carry.** A default identity (the one James derives from the user's address, `name` = the address) that has never been updated loses its `name` (`"bob@example.com"` becomes `""`) when it is patched with `{"textSignature": "Bob"}`. RFC 8620 §5.3: the patch is applied to the current object; properties that are not in the patch keep their value.

#### Cause (James, line numbers at james-project `9aac85900f`, the TMail submodule)

- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/json/IdentitySerializer.scala:111`: `Json.reads[IdentityUpdateRequest]`, whose fields are all `Option[IdentityXxxUpdate]`, maps a JSON `null` to `None` (through the macro's nullable handling or the `optionReads` of line 87, `json.validateOpt[T]`), i.e. "property absent". So `IdentityReplyToUpdate(None)` / `IdentityBccUpdate(None)` (`server/data/data-jmap/src/main/scala/org/apache/james/jmap/api/identity/CustomIdentityDAO.scala:98-103`), which do exist to reset the value, are never built from JMAP. Same for the signatures and the name (`CustomIdentityDAO.scala:95-112`).
- `CustomIdentityDAO.scala:227-248` (`IdentityRepository.update`): when the identity is server-set and has no custom copy yet (line 240), it saves `identityUpdateRequest.asCreationRequest(serverSetIdentity.email, ...)` (lines 142-150), i.e. a new identity built from the patch alone, instead of applying the patch to `serverSetIdentity`. Everything the patch does not mention takes the creation defaults (`name` = `""`).
- For comparison, the WebAdmin path `IdentityUpdateRequest.fromJava` (lines 114-129) always builds `IdentityReplyToUpdate` / `IdentityBccUpdate`, so it resets them when absent: the opposite behaviour.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-identity-set-null-replyto-bcc`, `127.0.0.1:18440` JMAP, `127.0.0.1:18441` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates the users through WebAdmin, and after every `Identity/set` update prints the answer and the `Identity/get` of that identity:

- A: the default identity of `alice`: set `replyTo`/`bcc`, patch them to `null`, then to `[]`, then `replyTo: null` alone;
- B: an identity created with `Identity/set create` carrying `replyTo`/`bcc`: patch to `null`, then `[]`;
- C: `textSignature`/`htmlSignature`/`name` set to `null`;
- D: `bob`'s default identity, first update `{"textSignature": "Bob"}`.

```json
["Identity/set", {"accountId": "…", "update": {"<identity id>": {"replyTo": null, "bcc": null}}}, "u"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro: Identity/set update with `replyTo: null` / `bcc: null` is answered as `updated` but
// changes nothing: the previous replyTo / bcc stay. RFC 8621 §6 declares both
// `EmailAddress[]|null (default: null)`, and RFC 8620 §5.3 says a null patch value sets the
// property back to its default. `[]` (control) does clear them.
//
//   node repro.mjs [image ...]     default: both memory images below
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-identity-set-null-replyto-bcc,
// JMAP 127.0.0.1:18440, WebAdmin 127.0.0.1:18441), creates the user alice, then:
//   A. default (server-provided) identity: set replyTo/bcc, patch them to null, then to [];
//   B. identity created by Identity/set create with replyTo/bcc: patch to null, then to [];
//   C. the other properties with a default: textSignature/htmlSignature/name: null;
//   D. side finding: the first update of a server-provided identity drops the properties the
//      patch does not carry (its name "alice@example.com" becomes ""), on a second user.
// After every patch: the Identity/set answer, then Identity/get of that identity.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT = 'tmailbug-identity-set-null-replyto-bcc'
const J = process.env.JMAP ?? 'http://127.0.0.1:18440'
const W = process.env.WA ?? 'http://127.0.0.1:18441'
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
  return { user, accountId, call }
}

const PROPS = ['name', 'email', 'replyTo', 'bcc', 'textSignature', 'htmlSignature', 'sortOrder']

async function run(image) {
  const out = []
  const say = s => { console.log(s); out.push(s) }
  if (!process.env.NO_STACK) await startStack(image)
  await wa('PUT', `/domains/${D}`)
  const a = await account('alice')
  say(`image ${image}`)

  const get = async id => {
    const [[, res]] = await a.call([['Identity/get', { accountId: a.accountId, ids: [id], properties: PROPS }, 'g']])
    const { replyTo, bcc, name, textSignature, htmlSignature, sortOrder } = res.list[0] ?? {}
    // JSON.stringify drops undefined: a property missing from the Identity/get answer is not shown
    return j({ name, replyTo, bcc, textSignature, htmlSignature, sortOrder })
  }
  const patch = async (label, id, p) => {
    const [[name, res]] = await a.call([['Identity/set', { accountId: a.accountId, update: { [id]: p } }, 'u']])
    const answer = name === 'error' ? `error ${j(res)}`
      : res.updated && id in res.updated ? `updated ${j(res.updated[id])}`
        : `notUpdated ${j(res.notUpdated?.[id])}`
    say(`  ${label}`)
    say(`    patch      ${j(p)}`)
    say(`    Identity/set  -> ${answer}`)
    say(`    Identity/get  -> ${await get(id)}`)
  }

  const [[, ids]] = await a.call([['Identity/get', { accountId: a.accountId, properties: ['id', 'email'] }, 'g']])
  const def = ids.list[0].id
  const R = [{ name: 'Reply', email: 'reply@example.com' }]
  const B = [{ name: null, email: 'bcc@example.com' }]

  say('A. default identity (provided by the server, stored on its first update)')
  say(`  initial       Identity/get  -> ${await get(def)}`)
  await patch('A1. set replyTo and bcc', def, { replyTo: R, bcc: B })
  await patch('A2. replyTo: null, bcc: null', def, { replyTo: null, bcc: null })
  await patch('A3. control: replyTo: [], bcc: []', def, { replyTo: [], bcc: [] })
  await patch('A4. set replyTo again', def, { replyTo: R })
  await patch('A5. replyTo: null alone', def, { replyTo: null })

  say('B. identity created with Identity/set create')
  const [[, created]] = await a.call([['Identity/set', { accountId: a.accountId, create: { c: { email: a.user, name: 'Custom', replyTo: R, bcc: B } } }, 'c']])
  const cid = created.created?.c?.id
  if (!cid) throw new Error(`create failed: ${j(created)}`)
  say(`  created       Identity/get  -> ${await get(cid)}`)
  await patch('B1. replyTo: null, bcc: null', cid, { replyTo: null, bcc: null })
  await patch('B2. control: replyTo: [], bcc: []', cid, { replyTo: [], bcc: [] })

  say('C. other properties set to null (RFC 8621 §6: name, textSignature, htmlSignature are String, default "")')
  await patch('C1. set signatures', cid, { textSignature: 'sig', htmlSignature: '<p>sig</p>' })
  await patch('C2. textSignature: null, htmlSignature: null', cid, { textSignature: null, htmlSignature: null })
  await patch('C3. name: null', cid, { name: null })

  say('D. first update of a server-provided identity, patch without name (user bob)')
  const b = await account('bob')
  const [[, bids]] = await b.call([['Identity/get', { accountId: b.accountId, properties: PROPS }, 'g']])
  say(`  initial       Identity/get  -> ${j(bids.list[0])}`)
  const bid = bids.list[0].id
  const [[, bres]] = await b.call([['Identity/set', { accountId: b.accountId, update: { [bid]: { textSignature: 'Bob' } } }, 'u']])
  say(`  patch {"textSignature":"Bob"} -> ${bres.updated && bid in bres.updated ? 'updated' : j(bres)}`)
  const [[, bafter]] = await b.call([['Identity/get', { accountId: b.accountId, properties: PROPS }, 'g']])
  say(`  after         Identity/get  -> ${j(bafter.list[0])}`)
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
# TMail memory backend for the Identity/set null replyTo/bcc repro. Started by repro.mjs.
# jmap.properties is mounted for Basic auth (the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18440  JMAP
#   127.0.0.1:18441  WebAdmin
name: tmailbug-identity-set-null-replyto-bcc

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18440:80'
      - '127.0.0.1:18441:8000'
```

`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18440
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```

</details>

### Expected result

- `replyTo: null` / `bcc: null` set them back to `null` (`Identity/get` then returns `null`); `textSignature: null`, `htmlSignature: null`, `name: null` set them to `""`. If the server does not want to support resetting through `null`, it should at least answer `notUpdated` with `invalidProperties`, not `updated`.
- The first update of a server-provided identity only changes the patched properties: `name` stays `"bob@example.com"`.

**Actual** (`results-memory-1.0.21.2.txt`, `results-memory-branch-master.txt`: identical on both images):

| case | `Identity/set` | `Identity/get` after, `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|---|
| A2 / B1. `{"replyTo": null, "bcc": null}` after setting both | `updated {}` | **replyTo and bcc unchanged** | **unchanged** |
| A5. `{"replyTo": null}` alone | `updated {}` | **replyTo unchanged** | **unchanged** |
| A3 / B2. control `{"replyTo": [], "bcc": []}` | `updated {}` | `[]`, `[]` | `[]`, `[]` |
| C2. `{"textSignature": null, "htmlSignature": null}` | `updated {}` | **`"sig"`, `"<p>sig</p>"` unchanged** | **unchanged** |
| C3. `{"name": null}` | `updated {}` | **`"Custom"` unchanged** | **unchanged** |
| D. default identity, first patch `{"textSignature": "Bob"}` | `updated` | **`name` `"bob@example.com"` → `""`** | **same** |
| A1. default identity, first patch `{"replyTo": […], "bcc": […]}` | `updated {}` | **`name` `"alice@example.com"` → `""`** | **same** |

(`Identity/get` of a never-updated default identity also omits `replyTo` and `bcc` instead of returning `null`: reported separately, see Related.)

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (image created 2026-09-30), `linagora/tmail-backend:memory-branch-master` (created 2026-10-02). Image configuration except `jmap.properties` (Basic auth).
- The code is in James (`IdentitySerializer`, `IdentityRepository`), shared by the memory, postgresql and distributed flavours; only memory was run.
- No existing issue found here nor in the James JIRA (JAMES-3534 "Implement Identity/set" and JAMES-3893 "WebAdmin API allowing managing user identity" are the implementation tickets).

### Additional information

**Suggested fix (James)**

1. Read each patched property as "absent / null / value" instead of `Option`: e.g. a custom `Reads[IdentityUpdateRequest]` that maps `JsNull` on `replyTo` / `bcc` to `IdentityReplyToUpdate(None)` / `IdentityBccUpdate(None)`, and on `name` / `textSignature` / `htmlSignature` to the `""` default (`IdentityName("")`, `TextSignature.DEFAULT`, `HtmlSignature.DEFAULT`).
2. `IdentityRepository.update`, server-set identity without a custom copy (`CustomIdentityDAO.scala:240`): save `identityUpdateRequest.update(serverSetIdentity)` (the patched server-set identity) instead of `asCreationRequest(...)`.
3. Contract tests in `IdentitySetMethodContract`: `null` resets each property; a partial patch of a default identity keeps its `name`.

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`) sends `[]` instead of `null` to clear Reply-To and Bcc (`common/src/features/identities/IdentityFormDialog.tsx:219-220`, `identityMutations.ts:14-15`), and always sends the whole form (with `name`), so it does not hit either symptom today.
- tmail-flutter also sends the whole identity with an empty set for "no Reply-To" (`lib/features/identity_creator/presentation/identity_creator_controller.dart:535-553`), so the same applies.
- Any client that sends a minimal patch (only the changed field, as RFC 8620 allows) wipes the name of a default identity on its first edit, and cannot clear Reply-To/Bcc with `null` while being told it succeeded.

**Related:** #2682, #2684, #2685, #2686 (other issues found while building Twake Mail web on the memory image); `get-omits-null-properties` (candidate: `/get` omits properties whose value is `null`, seen here on `replyTo`/`bcc` of a default identity); `forward-set-partial-patch` and `label-set-color-null-and-changes-state` (candidates: other `/set` updates that do not follow PatchObject semantics).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
