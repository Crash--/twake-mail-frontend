### Description of the bug

The rules returned by `Filter/get` (`com:linagora:params:jmap:filter`) cannot be sent back as they are to `Filter/set`:

1. `Filter/get` returns rules **without `id`**, while `Filter/set` **requires** an `id` on every rule (`invalidArguments` "Missing '/update/singleton(0)/id' property") and refuses duplicates ("There are some duplicated rules"). The ids the client chose are stored (`Rule.Id` in James' `FilteringAggregate`) but never returned, so a client cannot keep track of a rule across reads, and must invent ids at every save.
2. `Filter/get` returns each rule with **both** `conditionGroup` and the legacy `condition`, and `Filter/set` refuses a rule that has both ("condition and conditionGroup cannot be specified at the same time"). So even with the ids put back, the `/get` output is not valid `/set` input.

The documentation contradicts itself on the id (`docs/modules/ROOT/pages/tmail-backend/jmap-extensions/jmapFilters.adoc`):
- section "Filter object", line 41: *"**id**: Server-set, `Id`, immutable, the JMAP identifier."*: a server-set property should be returned by `/get` and not be required from the client (RFC 8620 §5.3: the client may omit server-set properties);
- the `Filter/set` example (line 112) sends `"id": "1"`, and the `Filter/get` example response (lines 177-200) shows rules without `id` but with both `conditionGroup` and `condition` (line 44: `condition` is "still retained to keep backend compatible with frontend that has not been updated yet").

#### Cause (TMail, line numbers at tmail-backend `7cf9131`)

- `tmail-backend/jmap/extensions/src/main/scala/com/linagora/tmail/james/jmap/model/FilterGet.scala:73`: `case class Rule(name, conditionGroup, condition, action)`: no `id`. `Rule.fromJava` (lines 97-109) drops `rule.getId` and fills `condition` with the first condition of the group.
- `model/FilterSet.scala:53-55`: `RuleWithId(id: Id, ...)` / `SerializedRule(id: Id, ...)`: `id` mandatory on input.
- `json/FilterSerializer.scala:71-79` (`ruleWithIdReads`): refuses `condition` together with `conditionGroup`; `json/FilterSerializer.scala:66` writes `Rule` with both.
- Duplicates: James `server/data/data-jmap/src/main/java/org/apache/james/jmap/api/filtering/impl/FilteringAggregate.java:89` (`shouldNotContainDuplicates`).

### Reproduction Steps

Self-contained Node script (Node ≥ 22, no dependency, docker compose). It starts a fresh `linagora/tmail-backend:memory-*` (compose project `tmailbug-filter-get-rule-ids`, `127.0.0.1:18446` JMAP, `127.0.0.1:18447` WebAdmin, Basic auth through a mounted `jmap.properties` because the image's JWT key files are missing), creates `alice` through WebAdmin, then:

1. `Filter/set` two rules with ids `rule-a` and `rule-b`, then `Filter/get`;
2. `Filter/set` the rules exactly as `Filter/get` returned them; 2b. the same with ids put back; 2c. the same without the legacy `condition`;
3. a rule without `id`; 4. two rules with the same `id`.

<details>
<summary>repro.mjs, docker-compose.yaml, jmap.properties</summary>

`repro.mjs`:

```js
// Repro (com:linagora:params:jmap:filter): Filter/set requires an `id` on every rule (and
// refuses duplicates), but Filter/get never returns it, so a Filter/get -> Filter/set round trip
// of the unchanged rules is rejected and the ids the client chose are lost. The extension doc
// calls Rule.id "Server-set, immutable", yet its own Filter/set example sends it and its
// Filter/get example omits it. The round trip also fails on the legacy `condition` that
// Filter/get adds next to `conditionGroup`, which Filter/set refuses to receive together.
//
//   node repro.mjs [image ...]     default: both memory images below
//   NO_STACK=1 JMAP=... WA=... node repro.mjs   run against an already running server
//
// For each image: starts a fresh TMail (compose project tmailbug-filter-get-rule-ids,
// JMAP 127.0.0.1:18446, WebAdmin 127.0.0.1:18447), creates alice, then:
//   1. Filter/set two rules with ids "rule-a" and "rule-b", then Filter/get;
//   2. Filter/set the rules exactly as Filter/get returned them (round trip); 2b. same with the
//      ids put back; 2c. same without the legacy `condition` that Filter/get adds;
//   3. Filter/set a rule without id;  4. Filter/set two rules with the same id.
// Requires: docker compose, Node >= 22 (no dependency).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT = 'tmailbug-filter-get-rule-ids'
const J = process.env.JMAP ?? 'http://127.0.0.1:18446'
const W = process.env.WA ?? 'http://127.0.0.1:18447'
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
  say(`filter capability: ${j(a.session.capabilities['com:linagora:params:jmap:filter'])}`)
  const [[, mbx]] = await a.call([['Mailbox/get', { accountId: a.accountId, properties: ['role'] }, 'm']])
  const archive = mbx.list.find(m => m.role === 'archive')?.id ?? mbx.list.find(m => m.role === 'inbox').id

  const rule = (id, name, value) => ({
    ...(id === undefined ? {} : { id }),
    name,
    conditionGroup: { conditionCombiner: 'AND', conditions: [{ field: 'subject', comparator: 'contains', value }] },
    action: { appendIn: { mailboxIds: [archive] } },
  })
  const set = async (label, rules) => {
    const [[name, res]] = await a.call([['Filter/set', { accountId: a.accountId, update: { singleton: rules } }, 's']])
    say(label)
    say(`  rule ids sent  ${j(rules.map(r => r.id ?? '(none)'))}`)
    say(`  Filter/set     -> ${name === 'error' ? `error ${j(res)}` : res.updated?.singleton !== undefined ? 'updated' : `notUpdated ${j(res.notUpdated?.singleton)}`}`)
  }
  const get = async () => {
    const [[, res]] = await a.call([['Filter/get', { accountId: a.accountId, ids: ['singleton'] }, 'g']])
    return res.list[0].rules
  }

  await set('1. two rules with client-chosen ids', [rule('rule-a', 'A', 'alpha'), rule('rule-b', 'B', 'beta')])
  const rules = await get()
  say(`  Filter/get     -> ${rules.length} rules, keys of the first one: ${j(Object.keys(rules[0]))}`)
  say(`  Filter/get     -> "id" present on each rule: ${j(rules.map(r => 'id' in r))}`)
  say(`  first rule as returned: ${j(rules[0])}`)
  await set('2. round trip: Filter/set of the rules exactly as Filter/get returned them', rules)
  await set('2b. same round trip with the ids put back (Filter/get also returns the legacy "condition" next to "conditionGroup")',
    rules.map((r, i) => ({ id: `rule-${i}`, ...r })))
  await set('2c. same, ids put back and the legacy "condition" removed',
    rules.map(({ condition, ...r }, i) => ({ id: `rule-${i}`, ...r })))
  await set('3. a rule without id', [rule(undefined, 'C', 'gamma')])
  await set('4. two rules with the same id', [rule('x', 'D', 'delta'), rule('x', 'E', 'epsilon')])
  say(`  Filter/get after 2-4 -> names ${j((await get()).map(r => r.name))}`)
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
# TMail memory backend for the Filter/get rule ids repro. Started by repro.mjs.
# jmap.properties is mounted for Basic auth (the image's JWT key files are missing).
# Ports bound to 127.0.0.1 only:
#   127.0.0.1:18446  JMAP
#   127.0.0.1:18447  WebAdmin
name: tmailbug-filter-get-rule-ids

services:
  james:
    image: ${TMAIL_IMAGE:-linagora/tmail-backend:memory-1.0.21.2}
    volumes:
      - ./jmap.properties:/root/conf/jmap.properties:ro
    ports:
      - '127.0.0.1:18446:80'
      - '127.0.0.1:18447:8000'
```

`jmap.properties`:

```properties
# The image's jmap.properties points to JWT key files that the image does not ship (startup
# fails without them). This one only switches to Basic auth; everything else is the image default.
enabled=true
tls.keystoreURL=file://conf/keystore
tls.secret=james72laBalle
url.prefix=http://127.0.0.1:18446
authentication.strategy.rfc8621=BasicAuthenticationStrategy
view.email.query.enabled=true
calendarEvent.reply.mailTemplateLocation=file://eml-template/
calendarEvent.reply.supportedLanguages=en,fr,mn
```

</details>

### Expected result

Either the rule `id` is really server-set (optional in `Filter/set`, generated when absent, returned by `Filter/get`), or it is client-set and then returned by `Filter/get` as it was sent. In both cases, `Filter/set` of what `Filter/get` returned succeeds and changes nothing.

**Actual** (`results-memory-1.0.21.2.txt`, `results-memory-branch-master.txt`, identical):

| case | `memory-1.0.21.2` | `memory-branch-master` |
|---|---|---|
| 1. `Filter/set` ids `rule-a`, `rule-b` | `updated` | `updated` |
| 1. `Filter/get` | **rules without `id`**; keys `name`, `conditionGroup`, `condition`, `action` | **same** |
| 2. round trip, rules as returned | **method error `invalidArguments` "Missing '/update/singleton(0)/id' property"** | **same** |
| 2b. round trip with ids put back | **`invalidArguments` "condition and conditionGroup cannot be specified at the same time"** | **same** |
| 2c. ids put back, `condition` removed | `updated` | `updated` |
| 3. rule without `id` | method error "Missing '/update/singleton(0)/id' property" | same |
| 4. two rules with the same `id` | `notUpdated` "There are some duplicated rules" | same |

### Context

- `linagora/tmail-backend:memory-1.0.21.2` (image created 2026-09-30), `linagora/tmail-backend:memory-branch-master` (created 2026-10-02). Image configuration except `jmap.properties` (Basic auth). Filter capability `{"version": 2}`.
- The code is shared by every flavour; only memory was run.
- No existing issue found (`gh search issues --repo linagora/tmail-backend "Filter rule id"`).

### Additional information

**Suggested fix (TMail)**

1. Add `id` to `FilterGet.Rule` (`Rule.fromJava`: `rule.getId.asString`) and to the doc's `Filter/get` example. This is additive.
2. Accept, in `Filter/set`, a rule carrying both `condition` and `conditionGroup` when they agree (or ignore `condition` when `conditionGroup` is present), so that the `/get` output is valid `/set` input. Alternatively stop returning `condition` once the clients that need it are gone.
3. Decide whether the id is server-set: if so, make it optional on input and generate it (and fix line 41 of the doc otherwise: "client-set, unique within the list").

**Impact on clients**

- Twake Mail web (`twake-mail-frontend`) renumbers the rules by position and strips `condition` before every `Filter/set` (`common/src/features/rules/rules.ts:177-190`: "each with an id (its position, as tmail-flutter numbers them; `Filter/get` gives none) and its conditions as a group, without the legacy single condition").
- tmail-flutter renumbers them by position too (`lib/features/manage_account/data/extensions/list_tmail_rule_extensions.dart`, `withIds`).
- Consequence for both: a rule's id is its index, so it changes whenever a rule above it is removed or the rules are reordered; nothing can refer to a rule durably (e.g. "edit this rule" across devices, or a future `FolderFilteringAction` limited to one rule).

**Related:** #2682, #2684, #2685, #2686 (other issues found while building Twake Mail web on the memory image).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
