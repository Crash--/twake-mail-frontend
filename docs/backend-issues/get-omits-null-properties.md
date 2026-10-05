### Description of the bug

The `/get` methods leave out the **requested** properties whose value is `null`, instead of returning them with a `null` value. Measured on `Email/get`, `Mailbox/get`, `Identity/get` and `VacationResponse/get`:

| object | requested properties missing from the response when they have no value |
|---|---|
| `Email` | `sender`, `to`, `cc`, `bcc`, `replyTo`, `subject` |
| `EmailAddress` (in `from`, `to`…) | `name` |
| `EmailBodyPart` (explicit `bodyProperties`) | `name`, `disposition`, `cid`, `language`, `location` |
| `Mailbox` | `role` (every non-system folder), `parentId` (every top-level mailbox, INBOX included) |
| `Identity` | `replyTo`, `bcc` |
| `VacationResponse` | `fromDate`, `toDate`, `subject`, `textBody`, `htmlBody` |

The server is not even consistent within one `Email/get`: in the same response, `inReplyTo`, `references`, `header:X-Absent`, **`header:To:asAddresses`** and **`header:Subject:asText`** are returned as `null`, while `to` and `subject`, which RFC 8621 §4.1.3 defines as "identical to the value of `header:To:asAddresses`" / "`header:Subject:asText`", are left out.

What the RFCs say:

- RFC 8620 §5.1 (`/get`, `properties`): "If supplied, only the properties listed in the array are returned for each Foo object. If null, all properties of the object are returned." Every listed property is returned; nothing allows the server to drop the ones whose value is `null`. (The omission rule of RFC 8620 §3.5, "the server MAY omit any argument in a response that has the default value", is about method **arguments**, not object properties.)
- The data types declare these properties nullable rather than optional: `to: "EmailAddress[]|null"`, `subject: "String|null"` (RFC 8621 §4.1.3), `name: "String|null"` (§4.1.2.3: "[…] Otherwise, this property is null."), `role: "String|null" (default: null)`, `parentId: "Id|null"` (§2), `replyTo`/`bcc: "EmailAddress[]|null"` (§6), `fromDate`, `toDate`, `subject`, `textBody`, `htmlBody` (§8).
- RFC 8621 §4.1.3, header field properties: "If no header fields exist in the message with the requested name, the value is null if fetching a single instance". The convenience properties are defined as identical to those header properties, so their value is `null`, not absent.

The RFC has no sentence saying "a requested property without a value MUST be returned as null" in so many words, so this is a conformance gap rather than a hard MUST violation; but the RFC examples return `null` (`"parentId": null` in RFC 8621 §2.6, `{ "name": null, "email": … }` in §4.1.2.3, `"subject": null` in §5.2), and strictly typed clients break on it.

#### Cause (James upstream, line numbers at james-project `9aac85900f`, the TMail submodule; identical on apache/james-project `master` today)

play-json's `Json.writes` (and `writeNullable`) omit a field whose value is `None`. The serializers of `server/protocols/jmap-rfc-8621/src/main/scala/org/apache/james/jmap/json/` use them for every `Option` property:

- `EmailGetSerializer.scala:162` `Json.writes[EmailHeaders]`, on `mail/Email.scala:393-404`: `to`, `cc`, `bcc`, `from`, `sender`, `replyTo`, `subject`, `sentAt` are `Option[...]` → omitted; `messageId`, `inReplyTo`, `references` are `MessageIdsHeaderValue(Option[...])` written with `Json.valueWrites` (line 103) → `null`. Hence the inconsistency.
- `EmailGetSerializer.scala:83` `Json.writes[EmailAddress]` (`name: Option[EmailerName]`); `:145-154` `writeNullable` for the body part `blobId`, `name`, `charset`, `disposition`, `cid`, `language`, `location`. The `header:*` properties go through a `Map[String, Option[EmailHeaderValue]]` (`:156`, `:169`…), which play-json writes as `null`: those are right.
- `MailboxSerializer.scala:116` `Json.writes[Mailbox]` (`parentId`, `role` are `Option`).
- `IdentitySerializer.scala:55` `Json.writes[Identity]` (`replyTo`, `bcc`).
- `VacationSerializer.scala:69` `Json.writes[VacationResponse]`.

TMail's own extensions use the same pattern (not measured here).

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-get-omits-null-properties`, `127.0.0.1:18428` JMAP, `127.0.0.1:18429` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates `alice`, creates a draft with only `mailboxIds`, `keywords`, `from: [{email}]` and a text body, and gets it with every RFC 8621 §4.1 property listed explicitly; then `Mailbox/get`, `Identity/get`, `VacationResponse/get` with every property listed. It prints, per object, the requested properties missing from the response and those returned as `null`.

Request of case A:

```json
["Email/get", {"accountId": "…", "ids": ["…"], "properties": ["id", "blobId", "threadId", "mailboxIds", "keywords", "size",
  "receivedAt", "messageId", "inReplyTo", "references", "sender", "from", "to", "cc", "bcc", "replyTo", "subject", "sentAt",
  "hasAttachment", "preview", "textBody", "htmlBody", "attachments", "bodyValues",
  "header:X-Absent", "header:X-Absent:asText", "header:X-Absent:all", "header:To:asAddresses", "header:Subject:asText"],
  "bodyProperties": ["partId", "blobId", "size", "headers", "name", "type", "charset", "disposition", "cid", "language", "location"]}, "0"]
```

Response (abridged): `"inReplyTo": null, "references": null, "header:To:asAddresses": null, "header:Subject:asText": null, "from": [{"email": "alice@example.com"}]`, and no `to`, `cc`, `bcc`, `sender`, `replyTo`, `subject` keys.

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro: the /get methods of tmail-backend leave out the requested properties whose value is null
// (Email from/to/subject/messageId..., EmailAddress name, body part name/cid..., Mailbox role and
// parentId, Identity replyTo/bcc, VacationResponse dates...) instead of returning them with a null
// value. Meanwhile "header:X-Absent" is returned as null: the server is not consistent.
//
//   node repro.mjs [image ...]   default: memory-1.0.21.2 and memory-branch-master
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-get-omits-null-properties,
// JMAP 127.0.0.1:18428, WebAdmin 127.0.0.1:18429), creates the user alice, then:
//   A. Email/set create a draft with only mailboxIds, keywords, from (no name) and a text body
//      (no to, cc, bcc, replyTo, sender, subject, inReplyTo, references), then Email/get it with
//      every RFC 8621 §4.1 property listed explicitly, plus header:X-Absent (single, :asText,
//      :all), header:To:asAddresses and header:Subject:asText (which "to" and "subject" are
//      "identical to", RFC 8621 §4.1.3), and bodyProperties listed explicitly for textBody;
//   B. Mailbox/set create a top-level folder, Mailbox/get every §2 property of it and of INBOX;
//   C. Identity/get every §6 property;
//   D. VacationResponse/get every RFC 8621 §8 property.
// For each object it prints the requested properties that are MISSING from the response, and
// the ones returned as null.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const J = process.env.JMAP ?? 'http://127.0.0.1:18428'
const W = process.env.WA ?? 'http://127.0.0.1:18429'
const PROJECT = 'tmailbug-get-omits-null-properties'
const USING = ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail', 'urn:ietf:params:jmap:submission', 'urn:ietf:params:jmap:vacationresponse']
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
  const mailboxes = (await call([['Mailbox/get', { accountId }, '0']]))[0][1].list
  const role = r => mailboxes.find(m => m.role === r).id
  return { user, accountId, call, drafts: role('drafts'), inbox: role('inbox') }
}

const out = []
const say = s => { console.log(s); out.push(s) }
const j = v => JSON.stringify(v)

function report(label, requested, object) {
  const missing = requested.filter(p => !(p in object))
  const nulls = requested.filter(p => p in object && object[p] === null)
  say(`${label}\n  requested ${requested.length}, MISSING ${missing.length}: [${missing.join(', ')}]\n  returned as null: [${nulls.join(', ')}]`)
  return missing
}

// RFC 8621 §4.1 (metadata, convenience headers, body), all of them listed explicitly.
const EMAIL_PROPERTIES = ['id', 'blobId', 'threadId', 'mailboxIds', 'keywords', 'size', 'receivedAt',
  'messageId', 'inReplyTo', 'references', 'sender', 'from', 'to', 'cc', 'bcc', 'replyTo', 'subject', 'sentAt',
  'hasAttachment', 'preview', 'textBody', 'htmlBody', 'attachments', 'bodyValues']
const HEADER_PROPERTIES = ['header:X-Absent', 'header:X-Absent:asText', 'header:X-Absent:all', 'header:To:asAddresses', 'header:Subject:asText']
// RFC 8621 §4.1.4 EmailBodyPart
const BODY_PROPERTIES = ['partId', 'blobId', 'size', 'headers', 'name', 'type', 'charset', 'disposition', 'cid', 'language', 'location']
// RFC 8621 §2
const MAILBOX_PROPERTIES = ['id', 'name', 'parentId', 'role', 'sortOrder', 'totalEmails', 'unreadEmails', 'totalThreads', 'unreadThreads', 'myRights', 'isSubscribed']
// RFC 8621 §6
const IDENTITY_PROPERTIES = ['id', 'name', 'email', 'replyTo', 'bcc', 'textSignature', 'htmlSignature', 'mayDelete']
// RFC 8621 §8
const VACATION_PROPERTIES = ['id', 'isEnabled', 'fromDate', 'toDate', 'subject', 'textBody', 'htmlBody']

async function run() {
  const a = await account('alice')

  const [[, set]] = await a.call([['Email/set', { accountId: a.accountId, create: { d: {
    mailboxIds: { [a.drafts]: true }, keywords: { $draft: true }, from: [{ email: a.user }],
    bodyValues: { t: { value: 'body' } }, textBody: [{ partId: 't', type: 'text/plain' }],
  } } }, '0']])
  const id = set.created.d.id
  const requested = [...EMAIL_PROPERTIES, ...HEADER_PROPERTIES]
  const [[, got]] = await a.call([['Email/get', { accountId: a.accountId, ids: [id], properties: requested, bodyProperties: BODY_PROPERTIES }, '0']])
  const email = got.list[0]
  say('A. Email/set create {mailboxIds, keywords, from: [{email}], textBody}; Email/get with explicit properties')
  report('  Email', requested, email)
  say(`  header:* values: ${HEADER_PROPERTIES.map(p => `${p}=${j(email[p])}`).join(', ')}`)
  say(`  from: ${j(email.from)}`)
  report('  from[0] (EmailAddress, RFC 8621 §4.1.2.3: name String|null)', ['name', 'email'], email.from?.[0] ?? {})
  report('  textBody[0] (EmailBodyPart, explicit bodyProperties)', BODY_PROPERTIES, email.textBody?.[0] ?? {})
  const [[, all]] = await a.call([['Email/get', { accountId: a.accountId, ids: [id] }, '0']])
  say(`  Email/get with properties omitted (default list of RFC 8621 §4.2): keys returned [${Object.keys(all.list[0]).sort().join(', ')}]`)

  say('B. Mailbox/get')
  const [[, mset]] = await a.call([['Mailbox/set', { accountId: a.accountId, create: { f: { name: 'Folder' } } }, '0']])
  const [[, mget]] = await a.call([['Mailbox/get', { accountId: a.accountId, ids: [mset.created.f.id, a.inbox], properties: MAILBOX_PROPERTIES }, '0']])
  report('  top-level user folder "Folder"', MAILBOX_PROPERTIES, mget.list.find(m => m.id === mset.created.f.id))
  report('  INBOX', MAILBOX_PROPERTIES, mget.list.find(m => m.id === a.inbox))

  say('C. Identity/get')
  const [[, iget]] = await a.call([['Identity/get', { accountId: a.accountId, properties: IDENTITY_PROPERTIES }, '0']])
  report('  default identity', IDENTITY_PROPERTIES, iget.list[0])

  say('D. VacationResponse/get')
  const [[name, vget]] = await a.call([['VacationResponse/get', { accountId: a.accountId, properties: VACATION_PROPERTIES }, '0']])
  if (name === 'VacationResponse/get') report('  singleton', VACATION_PROPERTIES, vget.list[0])
  else say(`  ${name} ${j(vget)}`)
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
# TMail memory backend for the get-omits-null-properties repro. Started by repro.mjs.
# Only jmap.properties is mounted (Basic auth, as the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18428  JMAP
#   127.0.0.1:18429  WebAdmin
name: tmailbug-get-omits-null-properties

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18428:80'
      - '127.0.0.1:18429:8000'
```
`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18428
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```
</details>

### Expected result

Every requested property is present; the ones without a value are `null`.

**Actual** (identical on both images):

| object | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|
| `Email` (29 properties requested) | **6 missing**: `sender`, `to`, `cc`, `bcc`, `replyTo`, `subject`; `null`: `inReplyTo`, `references`, `header:X-Absent`, `header:X-Absent:asText`, `header:To:asAddresses`, `header:Subject:asText` | same |
| `Email/get` without `properties` (default list of §4.2) | same 6 missing | same |
| `from[0]` | **`name` missing** | same |
| `textBody[0]` (11 `bodyProperties`) | **5 missing**: `name`, `disposition`, `cid`, `language`, `location` | same |
| `Mailbox` "Folder" (top level) | **`parentId`, `role` missing** | same |
| `Mailbox` INBOX | **`parentId` missing** | same |
| `Identity` | **`replyTo`, `bcc` missing** | same |
| `VacationResponse` | **5 missing**: `fromDate`, `toDate`, `subject`, `textBody`, `htmlBody` | same |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (2026-09-30), `linagora/tmail-backend:memory-branch-master` (built 2026-10-02). Image configuration, except `jmap.properties` (Basic auth).
- Serialisation code, shared by every backend; not run on the distributed or postgresql images.

### Additional information

**Suggested fix** (James): write `null` for absent optional properties in the JMAP serializers, e.g. a small helper (or play-json's `Json.configured(JsonConfiguration(optionHandlers = OptionHandlers.WritesNull)).writes[...]`, play-json ≥ 2.8) for `EmailHeaders`, `EmailAddress`, `EmailBodyPart`, `Mailbox`, `Identity`, `VacationResponse`; the `properties` filter applied afterwards (`core/Properties.scala:62`) already keeps only what was requested. A contract test per `/get` method, "a requested property without value is returned as null", would keep it. The change only adds keys to responses.

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`) normalises the missing properties to `null` itself (`Mailbox.role`, `Email.from`/`to`, `EmailAddress.name`) because its types (and `jmap-client-ts`'s) say `X | null`; each new property it reads needs the same care.
- tmail-flutter (`jmap_dart_client`) decodes a missing key as `null`, so it is not affected.
- Strictly typed or schema-validating clients (TypeScript with `exactOptionalPropertyTypes`, JSON-schema validation, Swift/Kotlin decoders with non-optional nullable fields) fail or mis-detect, and caches that merge partial objects cannot tell "unchanged / not fetched" from "now null".

**Related:** #2685 and #2686 (other `Email/set` / `Email/get` deviations found while building the Twake Mail web client), #2682, #2684.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
