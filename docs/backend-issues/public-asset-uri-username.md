### Description of the bug

Two related points on public assets (`com:linagora:params:jmap:public:assets`):

1. **The doc describes another URL.** `PublicAsset.publicURI` is `{url.prefix}/publicAsset/{username}/{assetId}`, e.g. `http://…/publicAsset/alice@example.com/6d41b0c2-c07d-11f1-b97b-a75bbfc0209c`. `docs/modules/ROOT/pages/tmail-backend/jmap-extensions/publicAssets.adoc`, section "PublicAsset" (line 55), says: *"The public URI is generated following this pattern: `{jmap_endpoint}/publicAsset/{account_id}/{asset_id}`"*, and its examples (lines 43, 114) put the account id there. The documented form answers 404. Using the username was a deliberate choice in #1045 (the repository is keyed by username; "the recipient got the username of the sender anyway"), but the doc was never updated.
2. **Public assets are not moved when a username changes.** After a WebAdmin rename (`POST /users/{old}/rename/{new}?action=rename`), the task runs ten `UsernameChangeTaskStep`s, none for public assets: the new user's `PublicAsset/get` returns nothing, its signatures' images belong to an account that is no longer theirs, and the URLs already sent keep working only as long as the old user exists. If the old user's data is later deleted, `PublicAssetDeletionTaskStep` removes the assets and every signature image already sent breaks.

**Privacy / security assessment of the username in the URL** (measured where possible):
- The URL is public and travels in every email whose signature has an image, so it discloses the account's **login**. Usually that is the sender address, already in `From`, hence low impact. It is not when the user signs **with an alias identity**: an asset bound to `support@example.com` (alias of `alice@example.com`) is served at `/publicAsset/alice@example.com/…`, so recipients of a "support@" email learn the personal login behind it (step 1). The same should hold for team-mailbox or delegated identities (the asset belongs to the user who uploads it; not measured), and for deployments whose usernames are not the address.
- **No user enumeration**: an unknown user and an existing user with an unknown asset id give the same `404` with the same body (step 2). The username part is case-insensitive.
- Asset ids are **time-based UUIDs** (version 1) and not random ones: within one JVM, all ids share the node and clock-sequence fields, so their unpredictability comes only from the creation time. Guessing one still needs about 10⁷ requests per second of uncertainty on the creation time, for an image that its owner already publishes; worth a v4 UUID as hardening, not a vulnerability.
- Using the account id instead (as documented) would not hide much: it is `sha256(username)`, which anyone can compute for a candidate address (point already made in #1045). It would avoid showing the login in clear text, e.g. to recipients of an alias.

#### Cause (TMail, line numbers at tmail-backend `7cf9131`)

- `tmail-backend/jmap/extensions-api/src/main/scala/com/linagora/tmail/james/jmap/publicAsset/PublicAssetRequest.scala:57-68` (`PublicURI.from`): path segments `publicAsset`, `username.asString()`, `assetId`. Called by `MemoryPublicAssetRepository.scala:56`, `CassandraPublicAssetRepository.scala:55`, `PostgresPublicAssetRepository.scala:51`; the Cassandra and Postgres DAOs store the resulting URI (`CassandraPublicAssetDAO.scala:186`, `PostgresPublicAssetDAO.scala:139`), so existing assets keep their URI whatever the code later does.
- `jmap/extensions/src/main/scala/com/linagora/tmail/james/jmap/publicAsset/PublicAssetRoutes.scala:60-62,75`: route `/publicAsset/{username}/{assetId}`, looked up with `Username.of(...)`.
- `publicAsset/PublicAssetsModule.scala:54`: only a `PublicAssetDeletionTaskStep` is bound; there is no public asset `UsernameChangeTaskStep` (labels, JMAP settings, contacts, filters, forwards... have one).
- `PublicAssetIdFactory.generate()` (`PublicAssetRequest.scala:72`): `UuidCreator.getTimeBased`.

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-public-asset-uri-username`, `127.0.0.1:18450` JMAP, `127.0.0.1:18451` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates `alice` and the alias `support@example.com` through WebAdmin, then:

1. uploads a 1×1 PNG, `PublicAsset/set create` bound to the alias identity, `PublicAsset/get`;
2. unauthenticated `GET` on `publicURI`, on the documented `/publicAsset/{accountId}/{assetId}`, and on unknown asset ids for an existing and an unknown user;
3. renames `alice` to `alice.new` (WebAdmin, task awaited), then `GET`s the old URL and the same asset under the new username, and lists `alice.new`'s public assets.

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro (com:linagora:params:jmap:public:assets): PublicAsset.publicURI is
// `{prefix}/publicAsset/{username}/{assetId}`, while publicAssets.adoc documents
// `{jmap_endpoint}/publicAsset/{account_id}/{asset_id}`; the documented form answers 404.
// Also measures what the username in a public URL implies: the address of a user who signs
// with an alias identity, whether the route tells existing from unknown users, and what a
// username change (WebAdmin rename) does to the assets and to the URLs already sent.
//
//   node repro.mjs [image ...]     default: both memory images below
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-public-asset-uri-username,
// JMAP 127.0.0.1:18450, WebAdmin 127.0.0.1:18451), creates alice and an alias
// support@example.com -> alice, then:
//   1. uploads a 1x1 PNG, PublicAsset/set create bound to the alias identity, PublicAsset/get;
//   2. GET (no auth) on publicURI, on the documented /publicAsset/{accountId}/{assetId}, and on
//      unknown asset ids for an existing and a non-existing user (status + body);
//   3. renames alice to alice.new@example.com (WebAdmin, task awaited), then GETs the old URL and
//      lists the new user's public assets.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT = 'tmailbug-public-asset-uri-username'
const J = process.env.JMAP ?? 'http://127.0.0.1:18450'
const W = process.env.WA ?? 'http://127.0.0.1:18451'
const D = 'example.com'
const IMAGES = ['linagora/tmail-backend:memory-1.0.21.2', 'linagora/tmail-backend:memory-branch-master']
// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

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

async function account(name, { create = true } = {}) {
  const user = `${name}@${D}`
  if (create) await wa('PUT', `/users/${user}`, { password: 'secret' })
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


async function probe(url) {
  const r = await fetch(url) // no Authorization: the route is public
  const type = r.headers.get('content-type')
  const body = type?.startsWith('image/') ? `<${(await r.arrayBuffer()).byteLength} bytes>` : (await r.text()).slice(0, 160)
  return `${r.status} ${type} ${body}`
}

async function run(image) {
  const out = []
  const say = s => { console.log(s); out.push(s) }
  if (!process.env.NO_STACK) await startStack(image)
  await wa('PUT', `/domains/${D}`)
  const a = await account('alice')
  await wa('PUT', `/address/aliases/${a.user}/sources/support@${D}`)
  say(`image ${image}`)
  say(`alice: username ${a.user}, accountId ${a.accountId}; alias support@${D} -> ${a.user}`)

  const [[, idents]] = await a.call([['Identity/get', { accountId: a.accountId, properties: ['email'] }, 'i']])
  const alias = idents.list.find(i => i.email === `support@${D}`)
  say(`identities: ${j(idents.list.map(i => i.email))}`)

  const uploadUrl = a.session.uploadUrl.replace('{accountId}', a.accountId)
  const blob = await (await fetch(uploadUrl, { method: 'POST', headers: { Authorization: a.headers.Authorization, 'Content-Type': 'image/png' }, body: PNG })).json()
  const [[, set]] = await a.call([['PublicAsset/set', { accountId: a.accountId, create: { p: { blobId: blob.blobId, identityIds: { [alias.id]: true } } } }, 'p']])
  const asset = set.created?.p
  if (!asset) throw new Error(`PublicAsset/set create failed: ${j(set)}`)
  const [[, got]] = await a.call([['PublicAsset/get', { accountId: a.accountId, ids: [asset.id] }, 'g']])
  const uri = got.list[0].publicURI
  say('1. PublicAsset/set create (bound to the alias identity support@), then PublicAsset/get')
  say(`  publicURI  ${uri}`)
  say(`  contains the username: ${uri.includes(`/${a.user}/`)}; contains the accountId: ${uri.includes(a.accountId)}; contains the alias: ${uri.includes('support@')}`)

  say('2. GET without authentication')
  say(`  publicURI                                         -> ${await probe(uri)}`)
  say(`  documented form /publicAsset/{accountId}/{id}     -> ${await probe(`${J}/publicAsset/${a.accountId}/${asset.id}`)}`)
  say(`  /publicAsset/ALICE@EXAMPLE.COM/{id} (case)        -> ${await probe(`${J}/publicAsset/ALICE@EXAMPLE.COM/${asset.id}`)}`)
  say(`  existing user, unknown asset id                   -> ${await probe(`${J}/publicAsset/${a.user}/${randomUUID()}`)}`)
  say(`  unknown user, unknown asset id                    -> ${await probe(`${J}/publicAsset/nobody@${D}/${randomUUID()}`)}`)
  say(`  existing user, asset id not a UUID                -> ${await probe(`${J}/publicAsset/${a.user}/x`)}`)
  say(`  asset id generated: ${asset.id} (UUID version ${asset.id[14]})`)

  say('3. username change alice -> alice.new (WebAdmin POST /users/{old}/rename/{new}?action=rename)')
  const newUser = `alice.new@${D}`
  await wa('PUT', `/users/${newUser}`, { password: 'secret' })
  const task = await (await wa('POST', `/users/${a.user}/rename/${newUser}?action=rename`)).json()
  const done = await (await wa('GET', `/tasks/${task.taskId}/await?timeout=60s`)).json()
  say(`  rename task: ${done.status}; steps: ${j(Object.keys(done.additionalInformation?.status ?? {}))}`)
  say(`  ${j(done.additionalInformation?.status ?? done.additionalInformation)}`)
  say(`  old publicURI (already in sent signatures)        -> ${await probe(uri)}`)
  say(`  same asset under the new username                 -> ${await probe(`${J}/publicAsset/${newUser}/${asset.id}`)}`)
  say(`  old user still exists after the rename: ${(await fetch(`${W}/users/${a.user}`, { method: 'HEAD' })).status === 200}`)
  const n = await account('alice.new', { create: false })
  const [[, after]] = await n.call([['PublicAsset/get', { accountId: n.accountId, ids: null }, 'g']])
  say(`  alice.new PublicAsset/get ids: null               -> ${after.list?.length ?? j(after)} asset(s)`)
  const [[, nIdents]] = await n.call([['Identity/get', { accountId: n.accountId, properties: ['email'] }, 'i']])
  say(`  alice.new identities: ${j(nIdents.list.map(i => i.email))}`)
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
# TMail memory backend for the PublicAsset publicURI repro. Started by repro.mjs.
# jmap.properties is mounted for Basic auth (the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18450  JMAP
#   127.0.0.1:18451  WebAdmin
name: tmailbug-public-asset-uri-username

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18450:80'
      - '127.0.0.1:18451:8000'
```

`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18450
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```

</details>

### Expected result

- The doc describes the URL the server builds (or the server builds the documented one).
- After a username change, the user still owns their public assets, and the URLs already sent keep working.

**Actual** (`results-memory-1.0.21.2.txt`, `results-memory-branch-master.txt`, identical except generated ids):

| | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|
| `publicURI` of an asset bound to the alias `support@` | `…/publicAsset/alice@example.com/<id>`: **login, not alias, not account id** | same |
| `GET publicURI` (no auth) | `200 image/png` | same |
| `GET /publicAsset/{accountId}/{id}` (documented) | **`404`** | **`404`** |
| unknown asset id, existing user / unknown user | `404`, same body / `404`, same body | same |
| asset id | UUID version 1 | same |
| rename `alice` → `alice.new`: task steps | 10 steps, none for public assets | same |
| after rename: `GET` old `publicURI` | `200` (old user still exists) | same |
| after rename: same asset under `/publicAsset/alice.new@example.com/…` | `404` | same |
| after rename: `alice.new` `PublicAsset/get` (`ids: null`) | **0 assets** | **0 assets** |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (image created 2026-09-30), `linagora/tmail-backend:memory-branch-master` (created 2026-10-02). Image configuration except `jmap.properties` (Basic auth).
- The URL format and the rename steps are shared by every flavour; only memory was run.
- Existing discussion: #1045 (choice of the username in the route), #1027, #1051 (feature and spec, closed). No issue about the doc mismatch or the rename.

### Additional information

**Suggested fix**

1. Doc (`publicAssets.adoc` lines 43, 55, 114): describe `{jmap_endpoint}/publicAsset/{username}/{asset_id}`, state that the URI is opaque for clients and that it reveals the login, so that client developers know what a signature image discloses.
2. Rename: add a `PublicAssetUsernameChangeTaskStep` that moves the assets (and their `identityIds`) to the new username; since URLs already sent embed the old username, the route should keep serving them (e.g. look the asset up by id, or keep a redirect from the old username).
3. Optional hardening, for new assets only (clients treat `publicURI` as opaque): random (v4) asset ids, and a URL that does not contain the login (asset id alone, or an unguessable token), which the repository would need to index; existing URIs must keep working.

**Impact on clients**

- Twake Mail web and tmail-flutter both treat `publicURI` as opaque (`common/src/features/identities/signatureAssets.ts:33-34`; `lib/features/public_asset/domain/extensions/public_asset_extension.dart`), so a format change for new assets would not affect them.
- Users signing with an alias, a team mailbox identity or a delegated identity disclose their login in every email whose signature has an image. Users who are renamed lose their signature images from `PublicAsset/get`.

**Related:** #1045, #2682, #2684, #2685, #2686 (other issues found while building Twake Mail web on the memory image).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
