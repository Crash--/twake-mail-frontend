### Description of the bug

`Email/set` `create` with a `bodyStructure` property (RFC 8621 §4.1.4, §4.6) is **accepted and the property is silently dropped**: the email is created with an empty `text/plain` body and the client is told it succeeded. The body the user wrote is lost without any error.

James does not implement `bodyStructure` on create (documented in `server/protocols/jmap-rfc-8621/doc/specs/spec/mail/message.mdown:834-841`, tracked upstream by [JAMES-3536](https://issues.apache.org/jira/browse/JAMES-3536), open since 2021). Not implementing it is a known limitation; **accepting it silently** is the bug: RFC 8621 §4.6 says creation attempts that violate its constraints "SHOULD be rejected with an `invalidProperties` error", and RFC 8620 §5.3 defines `invalidProperties` for a record that "contains properties that are invalid". A server that cannot honour `bodyStructure` must reject the create rather than store something else.

The same leniency hides two other mistakes:

- `bodyStructure` **and** `htmlBody` together (forbidden by RFC 8621 §4.6: "If a bodyStructure property is given, there MUST NOT be textBody, htmlBody, or attachments properties") is accepted; `htmlBody` wins.
- Any unknown property (here `"notAnEmailProperty": true`) is accepted and ignored.

#### Cause (James upstream; line numbers at james-project `9aac85900f`)

- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/json/EmailSetSerializer.scala:314-351`: `EmailCreationRequestWithoutHeaders` has no `bodyStructure` field, and it is read with a plain `Json.reads` (line 439), which ignores unknown keys. `emailCreationRequestReads` (lines 440-449) only rejects `headers`.
- `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/mail/EmailSet.scala:202-237` (`toMime4JMessage`) and `245-253` (`createAlternativeBody`): with no `htmlBody`/`textBody`/`attachments`, `createAlternativeBody(None, None, …)` builds a `multipart/alternative` with one empty `text/plain` part.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-email-set-create-bodystructure-ignored`, `127.0.0.1:18412` JMAP, `127.0.0.1:18413` WebAdmin, Basic auth through a mounted `jmap.properties`), creates a user, then for each case one `Email/set create` in Drafts followed by an `Email/get` of what was stored.

Case A request:

```json
["Email/set", {"accountId": "…", "create": {"e": {
  "mailboxIds": {"<drafts>": true}, "subject": "A.", "from": [{"email": "user1@example.com"}],
  "bodyValues": {"t": {"value": "Hello in text"}, "h": {"value": "<p>Hello in <b>HTML</b></p>"}},
  "bodyStructure": {"type": "multipart/alternative", "subParts": [
    {"partId": "t", "type": "text/plain"}, {"partId": "h", "type": "text/html"}]}}}}, "0"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties, full output</summary>

`repro.mjs`:

```js
// Repro: Email/set create silently ignores "bodyStructure" (RFC 8621 §4.6): the email is created
// with an empty text/plain body instead of being rejected with invalidProperties. The same
// happens when bodyStructure is combined with htmlBody (forbidden by §4.6) and for any unknown
// property.
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   KEEP=1 node repro.mjs        leave the last stack running
//   NO_STACK=1 JMAP=... WA=... node repro.mjs [label]   against an already running server
//
// Starts TMail (compose project tmailbug-email-set-create-bodystructure-ignored,
// JMAP 127.0.0.1:18412, WebAdmin 127.0.0.1:18413), creates one user, then for each case one
// Email/set create in Drafts followed by Email/get (size, bodyStructure, textBody, htmlBody,
// bodyValues) of what was stored.
// Requires: docker compose, Node >= 22 (no dependency).
const PORT = 18412
const PROJECT = 'tmailbug-email-set-create-bodystructure-ignored'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? `http://127.0.0.1:${PORT}`
const W = process.env.WA ?? `http://127.0.0.1:${PORT + 1}`
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

let userSeq = 0
async function account(name = 'user') {
  const user = `${name}${(userSeq += 1)}@${D}`
  await wa('PUT', `/users/${user}`, { password: 'secret' })
  const auth = 'Basic ' + Buffer.from(`${user}:secret`).toString('base64')
  const headers = { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' }
  const session = await (await fetch(`${J}/jmap/session`, { headers })).json()
  const accountId = session.primaryAccounts['urn:ietf:params:jmap:mail']
  // raw: whole Response object; call: methodResponses
  const raw = async (methodCalls, extra = {}) => {
    const r = await fetch(`${J}/jmap`, { method: 'POST', headers, body: JSON.stringify({ using: USING, methodCalls, ...extra }), signal: AbortSignal.timeout(30_000) })
    const text = await r.text()
    try { return JSON.parse(text) } catch { return { httpStatus: r.status, text } }
  }
  const call = async methodCalls => (await raw(methodCalls)).methodResponses
  const upload = async (bytes, type) => (await (await fetch(`${J}/upload/${accountId}`, { method: 'POST', headers: { Authorization: auth, 'Content-Type': type }, body: bytes })).json())
  const download = async (blobId, name = 'x') => (await fetch(`${J}/download/${accountId}/${encodeURIComponent(blobId)}?name=${name}&accept=application/octet-stream`, { headers: { Authorization: auth } })).status
  const mailboxes = (await call([['Mailbox/get', { accountId }, '0']]))[0][1].list
  const role = r => mailboxes.find(m => m.role === r).id
  return { user, accountId, raw, call, upload, download, drafts: role('drafts'), inbox: role('inbox') }
}

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

const out = []
const say = s => { console.log(s); out.push(s) }
const short = v => { const s = JSON.stringify(v); return s.length > 400 ? s.slice(0, 400) + '…' : s }

async function main(run) {
  const images = process.argv.slice(2).length ? process.argv.slice(2) : ['linagora/tmail-backend:memory-1.0.21.2', 'linagora/tmail-backend:memory-branch-master']
  for (const image of images) {
    out.length = 0
    if (!process.env.NO_STACK) await startStack(image)
    await wa('PUT', `/domains/${D}`)
    say(`image ${image}`)
    try { await run() } finally {
      writeFileSync(`${DIR}/results-${image.split(':').pop()}.txt`, out.join('\n') + '\n')
      if (!process.env.NO_STACK && !process.env.KEEP) compose(image, 'down -v')
    }
  }
}

const bodyValues = { t: { value: 'Hello in text' }, h: { value: '<p>Hello in <b>HTML</b></p>' } }
const bodyStructure = { type: 'multipart/alternative', subParts: [{ partId: 't', type: 'text/plain' }, { partId: 'h', type: 'text/html' }] }
const CASES = {
  'A. bodyStructure (multipart/alternative text + html), no textBody/htmlBody': { bodyValues, bodyStructure },
  'B. bodyStructure + htmlBody (forbidden together by RFC 8621 §4.6)': { bodyValues, bodyStructure, htmlBody: [{ partId: 'h', type: 'text/html' }] },
  'C. unknown property "notAnEmailProperty" + textBody': { bodyValues, textBody: [{ partId: 't', type: 'text/plain' }], notAnEmailProperty: true },
  'D. control: textBody + htmlBody': { bodyValues, textBody: [{ partId: 't', type: 'text/plain' }], htmlBody: [{ partId: 'h', type: 'text/html' }] },
}
const part = p => p && `${p.type}${p.subParts ? `[${p.subParts.map(part).join(', ')}]` : ` (${p.size} bytes)`}`

await main(async () => {
  const a = await account()
  for (const [label, body] of Object.entries(CASES)) {
    say(label)
    const create = { mailboxIds: { [a.drafts]: true }, subject: label.slice(0, 2), from: [{ email: a.user }], ...body }
    say(`  request create: ${short(create)}`)
    const [[, res]] = await a.call([['Email/set', { accountId: a.accountId, create: { e: create } }, '0']])
    if (res.notCreated) { say(`  -> notCreated: ${short(res.notCreated.e)}`); continue }
    const { id } = res.created.e
    const [[, got]] = await a.call([['Email/get', { accountId: a.accountId, ids: [id], properties: ['size', 'bodyStructure', 'textBody', 'htmlBody', 'bodyValues'], bodyProperties: ['partId', 'type', 'size', 'subParts'], fetchAllBodyValues: true }, '0']])
    const e = got.list[0]
    say(`  -> created ${id}, size ${e.size}, bodyStructure ${part(e.bodyStructure)}`)
    say(`     textBody ${e.textBody.map(part).join(', ') || '[]'}, htmlBody ${e.htmlBody.map(part).join(', ') || '[]'}, bodyValues ${short(Object.values(e.bodyValues).map(v => v.value))}`)
  }
})
```

`docker-compose.yaml`:

```yaml
# TMail memory backend for the email-set-create-bodystructure-ignored repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18412  JMAP
#   127.0.0.1:18413  WebAdmin
name: tmailbug-email-set-create-bodystructure-ignored

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18412:80'
      - '127.0.0.1:18413:8000'
```

`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18412
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```

`results-memory-1.0.21.2.txt`:

```text
image linagora/tmail-backend:memory-1.0.21.2
A. bodyStructure (multipart/alternative text + html), no textBody/htmlBody
  request create: {"mailboxIds":{"5":true},"subject":"A.","from":[{"email":"user1@example.com"}],"bodyValues":{"t":{"value":"Hello in text"},"h":{"value":"<p>Hello in <b>HTML</b></p>"}},"bodyStructure":{"type":"multipart/alternative","subParts":[{"partId":"t","type":"text/plain"},{"partId":"h","type":"text/html"}]}}
  -> created 1, size 478, bodyStructure multipart/alternative[text/plain (0 bytes)]
     textBody text/plain (0 bytes), htmlBody text/plain (0 bytes), bodyValues [""]
B. bodyStructure + htmlBody (forbidden together by RFC 8621 §4.6)
  request create: {"mailboxIds":{"5":true},"subject":"B.","from":[{"email":"user1@example.com"}],"bodyValues":{"t":{"value":"Hello in text"},"h":{"value":"<p>Hello in <b>HTML</b></p>"}},"bodyStructure":{"type":"multipart/alternative","subParts":[{"partId":"t","type":"text/plain"},{"partId":"h","type":"text/html"}]},"htmlBody":[{"partId":"h","type":"text/html"}]}
  -> created 2, size 669, bodyStructure multipart/alternative[text/plain (17 bytes), text/html (27 bytes)]
     textBody text/plain (17 bytes), htmlBody text/html (27 bytes), bodyValues ["Hello in HTML\r\n\r\n","<p>Hello in <b>HTML</b></p>"]
C. unknown property "notAnEmailProperty" + textBody
  request create: {"mailboxIds":{"5":true},"subject":"C.","from":[{"email":"user1@example.com"}],"bodyValues":{"t":{"value":"Hello in text"},"h":{"value":"<p>Hello in <b>HTML</b></p>"}},"textBody":[{"partId":"t","type":"text/plain"}],"notAnEmailProperty":true}
  -> created 3, size 495, bodyStructure multipart/alternative[text/plain (13 bytes)]
     textBody text/plain (13 bytes), htmlBody text/plain (13 bytes), bodyValues ["Hello in text"]
D. control: textBody + htmlBody
  request create: {"mailboxIds":{"5":true},"subject":"D.","from":[{"email":"user1@example.com"}],"bodyValues":{"t":{"value":"Hello in text"},"h":{"value":"<p>Hello in <b>HTML</b></p>"}},"textBody":[{"partId":"t","type":"text/plain"}],"htmlBody":[{"partId":"h","type":"text/html"}]}
  -> created 4, size 671, bodyStructure multipart/alternative[text/plain (13 bytes), text/html (27 bytes)]
     textBody text/plain (13 bytes), htmlBody text/html (27 bytes), bodyValues ["Hello in text","<p>Hello in <b>HTML</b></p>"]
```

</details>

### Expected result

- A: either the email is created with the given structure (JAMES-3536), or, until that is implemented, `notCreated` with `invalidProperties` and `properties: ["bodyStructure"]`.
- B: `notCreated`, `invalidProperties` (`bodyStructure` together with `htmlBody`).
- C: `notCreated`, `invalidProperties` (`notAnEmailProperty`).

**Actual** (identical on `memory-1.0.21.2` and `memory-branch-master`):

| case | response | stored email |
|---|---|---|
| A. `bodyStructure` (alternative text + html) only | **created** | `multipart/alternative[text/plain (0 bytes)]`, `bodyValues: [""]` |
| B. `bodyStructure` + `htmlBody` | **created** | `bodyStructure` ignored, built from `htmlBody` (text part generated from the HTML) |
| C. unknown property + `textBody` | **created** | property ignored |
| D. control: `textBody` + `htmlBody` | created | `multipart/alternative[text/plain (13 bytes), text/html (27 bytes)]` |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (2026-09-30), `linagora/tmail-backend:memory-branch-master` (built 2026-10-02). The code is the generic James JMAP layer, so all backends behave the same (only memory was run).
- Image configuration, except `jmap.properties` (Basic auth).

### Additional information

**Suggested fix** (James)

- Minimal: in `emailCreationRequestReads`, reject a create containing `bodyStructure` with `invalidProperties` (`properties: ["bodyStructure"]`, description "bodyStructure is not supported on Email/set create, use textBody/htmlBody/attachments"), next to the existing `headers` check. Same treatment for any key that is neither an Email property nor a `header:` form.
- Full: implement JAMES-3536 (map the `EmailBodyPart` tree to mime4j, resolving `partId` from `bodyValues` and `blobId` from uploads/attachments), and reject `bodyStructure` combined with `textBody`/`htmlBody`/`attachments`.

**Impact on clients**

- Twake Mail web: the TipTap composer spike first tried to send its MIME tree (`multipart/related` with inline images) through `bodyStructure`; the drafts came back empty with no error. It now uses `htmlBody` + `textBody` + `attachments` (`disposition: inline`, `cid`), which James turns into `multipart/related[multipart/alternative[text, html], images]`.
- tmail-flutter only uses `htmlBody` + `attachments`, so it is not affected.
- Any third-party JMAP client that relies on `bodyStructure` (the RFC's way to send arbitrary MIME structures) silently loses the message content.

**Workaround**: use `textBody` / `htmlBody` / `attachments` only.

**Related:** JAMES-3536, #2684, #2686, #2682.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
