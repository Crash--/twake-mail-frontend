### Description of the bug

`Email/get` answers `["error", {"type": "serverFail", "description": "an implementation is missing"}]` whenever `attachments` is followed, in the `properties` list, by **any** other property, unless a body property (`htmlBody`, `textBody`, `bodyValues`, `bodyStructure`) came first. `["attachments", "id"]`, `["attachments", "subject"]`, `["attachments", "bodyValues"]` all fail; `["id", "attachments"]` works.

RFC 8620 §5.1 (and RFC 8621 §4.2 for `Email/get`) defines `properties` as the list of properties to return; nothing in the spec makes the answer depend on their order, and every listed property here is valid. #1868 reported the `["attachments", "hasAttachment"]` case and was closed on the ground that combining those two makes little sense; the cause is broader, though: **every** property placed after `attachments` triggers it, including `id` and `subject`, which a client cannot avoid requesting.

#### Cause (James upstream; line numbers at james-project `9aac85900f`)

`server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/mail/Email.scala:183-198`: `ReadLevel.combine(readLevel1, readLevel2)` has cases for `MetadataReadLevel`, `FullReadLevel`, `HeaderReadLevel` and `FastViewReadLevel` as **first** argument, and `case _ => throw new NotImplementedError()` (line 197). `FastViewWithAttachmentsMetadataReadLevel` (the level of `attachments`) only appears as second argument. `EmailGetRequest.readLevel` (`mail/EmailGet.scala:49-55`) folds the properties with `reduceOption(ReadLevel.combine)`, so as soon as the accumulator is `FastViewWithAttachmentsMetadataReadLevel` the next property throws.

Since `Properties` is a `Set` (`core/Properties.scala:40`), lists of more than 4 properties are folded in hash order, not in request order: long lists pass or fail depending on hashing, which makes the bug look random. The Twake Mail web and tmail-flutter lists below pass because, in the Set's iteration order, a body property happens to come before `attachments`.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-email-get-attachments-readlevel-serverfail`, `127.0.0.1:18414` JMAP, `127.0.0.1:18415` WebAdmin, Basic auth through a mounted `jmap.properties`), creates a user and one email (text + html + one PNG attachment) with `Email/set`, then sends one `Email/get` per `properties` list.

```json
["Email/get", {"accountId": "…", "ids": ["1"], "properties": ["attachments", "id"]}, "0"]
```

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro: Email/get answers serverFail (NotImplementedError in ReadLevel.combine) as soon as
// "attachments" is followed by any other property in the (Set-ordered) "properties" list,
// unless a "full" property (htmlBody, textBody, bodyValues, bodyStructure) came before it.
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   KEEP=1 node repro.mjs        leave the last stack running
//   NO_STACK=1 JMAP=... WA=... node repro.mjs [label]   against an already running server
//
// Starts TMail (compose project tmailbug-email-get-attachments-readlevel-serverfail,
// JMAP 127.0.0.1:18414, WebAdmin 127.0.0.1:18415), creates one user and one email
// (text + html + one PNG attachment) with Email/set, then sends one Email/get per
// "properties" list below and prints the method response name (and error description).
// Requires: docker compose, Node >= 22 (no dependency).
const PORT = 18414
const PROJECT = 'tmailbug-email-get-attachments-readlevel-serverfail'
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

const CASES = [
  ['attachments'],
  ['attachments', 'id'],
  ['id', 'attachments'],
  ['attachments', 'subject'],
  ['subject', 'attachments'],
  ['attachments', 'hasAttachment'],
  ['hasAttachment', 'attachments'],
  ['attachments', 'preview'],
  ['attachments', 'bodyValues'],
  ['attachments', 'htmlBody'],
  ['htmlBody', 'attachments'],
  ['subject', 'attachments', 'preview'],
  // Twake Mail web (twake-mail-frontend), verbatim
  ['id', 'threadId', 'mailboxIds', 'keywords', 'receivedAt', 'subject', 'from', 'to', 'cc', 'bcc', 'htmlBody', 'bodyValues', 'attachments', 'hasAttachment'],
  ['id', 'messageId', 'references', 'receivedAt', 'subject', 'from', 'to', 'cc', 'bcc', 'replyTo', 'htmlBody', 'bodyValues', 'attachments'],
  // tmail-flutter ThreadConstants.propertiesComposerEmailFetch / propertiesGetEmailContent
  ['id', 'blobId', 'threadId', 'htmlBody', 'attachments'],
  ['bodyValues', 'htmlBody', 'attachments', 'headers', 'keywords', 'mailboxIds', 'messageId', 'references'],
]

await main(async () => {
  const a = await account()
  const { blobId } = await a.upload(PNG, 'image/png')
  const [[, set]] = await a.call([['Email/set', { accountId: a.accountId, create: { e: {
    mailboxIds: { [a.drafts]: true }, subject: 'with attachment', from: [{ email: a.user }],
    bodyValues: { t: { value: 'hello' }, h: { value: '<p>hello</p>' } },
    textBody: [{ partId: 't', type: 'text/plain' }], htmlBody: [{ partId: 'h', type: 'text/html' }],
    attachments: [{ blobId, type: 'image/png', name: 'dot.png', disposition: 'attachment' }],
  } } }, '0']])
  const id = set.created.e.id
  say(`email ${id} created (text + html + 1 PNG attachment)`)
  say('| properties | response |')
  say('|---|---|')
  for (const properties of CASES) {
    const [[name, res]] = await a.call([['Email/get', { accountId: a.accountId, ids: [id], properties }, '0']])
    const verdict = name === 'Email/get' ? `Email/get, ${res.list.length} email, ${res.list[0]?.attachments?.length ?? '-'} attachment(s)` : `**${name} ${res.type}**${res.description ? ` (${res.description})` : ''}`
    say(`| \`${JSON.stringify(properties)}\` | ${verdict} |`)
  }
})
```

`docker-compose.yaml`:

```yaml
# TMail memory backend for the email-get-attachments-readlevel-serverfail repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18414  JMAP
#   127.0.0.1:18415  WebAdmin
name: tmailbug-email-get-attachments-readlevel-serverfail

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18414:80'
      - '127.0.0.1:18415:8000'
```

`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18414
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```

</details>

### Expected result

`Email/get` returns the email for every list (the property order is irrelevant).

**Actual** (identical on `memory-1.0.21.2` and `memory-branch-master`; the last four lists are, verbatim, Twake Mail web's reading view and composer source, and tmail-flutter's `propertiesComposerEmailFetch` and `propertiesGetEmailContent`):

| properties | response |
|---|---|
| `["attachments"]` | Email/get, 1 email, 1 attachment(s) |
| `["attachments","id"]` | **error serverFail** (an implementation is missing) |
| `["id","attachments"]` | Email/get, 1 email, 1 attachment(s) |
| `["attachments","subject"]` | **error serverFail** (an implementation is missing) |
| `["subject","attachments"]` | Email/get, 1 email, 1 attachment(s) |
| `["attachments","hasAttachment"]` | **error serverFail** (an implementation is missing) |
| `["hasAttachment","attachments"]` | Email/get, 1 email, 1 attachment(s) |
| `["attachments","preview"]` | **error serverFail** (an implementation is missing) |
| `["attachments","bodyValues"]` | **error serverFail** (an implementation is missing) |
| `["attachments","htmlBody"]` | **error serverFail** (an implementation is missing) |
| `["htmlBody","attachments"]` | Email/get, 1 email, 1 attachment(s) |
| `["subject","attachments","preview"]` | **error serverFail** (an implementation is missing) |
| `["id","threadId","mailboxIds","keywords","receivedAt","subject","from","to","cc","bcc","htmlBody","bodyValues","attachments","hasAttachment"]` | Email/get, 1 email, 1 attachment(s) |
| `["id","messageId","references","receivedAt","subject","from","to","cc","bcc","replyTo","htmlBody","bodyValues","attachments"]` | Email/get, 1 email, 1 attachment(s) |
| `["id","blobId","threadId","htmlBody","attachments"]` | Email/get, 1 email, 1 attachment(s) |
| `["bodyValues","htmlBody","attachments","headers","keywords","mailboxIds","messageId","references"]` | Email/get, 1 email, 1 attachment(s) |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (2026-09-30), `linagora/tmail-backend:memory-branch-master` (built 2026-10-02). The code is the generic James JMAP layer, so every backend is affected (#1868 was observed on jmap.linagora.com).
- Image configuration, except `jmap.properties` (Basic auth).

### Additional information

**Suggested fix** (James, one case in `ReadLevel.combine`), consistent with the existing `HeaderReadLevel`/`FastViewReadLevel` + `FastViewWithAttachmentsMetadataReadLevel` → `FastViewWithAttachmentsMetadataReadLevel` mappings:

```scala
    case FastViewWithAttachmentsMetadataReadLevel => readLevel2 match {
      case FullReadLevel => FullReadLevel
      case _ => FastViewWithAttachmentsMetadataReadLevel
    }
```

With it the `case _ => throw new NotImplementedError()` becomes unreachable and can go. A unit test over all pairs of `ReadLevel` (both orders) would lock it down.

**Impact on clients**

- Twake Mail web: the composer spike hit it when asking `attachments` together with `bodyValues` (without `htmlBody` first). The client now lists `htmlBody` before `attachments`, or asks for `attachments` alone, which is fragile.
- tmail-flutter: its lists contain `htmlBody`, which makes the fold reach `FullReadLevel` early enough today; any new list with `attachments` and without a body property (e.g. `["id", "attachments", "preview"]` for an attachment panel) fails.

**Workaround**: request `attachments` alone, or put `htmlBody`/`bodyValues` before it in a list of at most 4 properties (longer lists are folded in hash order, so only an actual call tells).

**Related:** #1868 (closed, `attachments` + `hasAttachment`), #2684, #2685, #2682.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
