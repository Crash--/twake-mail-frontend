import { createClient, type JmapClient, type Session } from 'jmap-client-ts'

import { METHOD_CAPABILITIES } from '@common/jmap/methodCapabilities'
import { WEBPUSH_VAPID_CAPABILITY } from '@common/jmap/pushSubscription'
import {
  FAKE_SESSION_URL,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import {
  confirmWebPush,
  endWebPush,
  forgetWebPush,
  syncWebPush
} from './webPush'

const TEXTS = { title: 'New email', body: 'Open Twake Mail to read it.' }
const OTHER = 'someone-else@example.com'
// 65 bytes, as an uncompressed P-256 point
const SERVER_KEY = btoa(
  String.fromCharCode(4, ...new Array<number>(64).fill(7))
)
  .replaceAll('+', '-')
  .replaceAll('/', '_')
  .replace(/=+$/, '')

interface FakeSubscription {
  endpoint: string
  options: { applicationServerKey: ArrayBuffer | null }
  unsubscribe: jest.Mock<Promise<boolean>, []>
  toJSON: () => { keys: { p256dh: string; auth: string } }
}

interface BrowserPush {
  registered: string[]
  current: () => FakeSubscription | null
  /** The accounts with a tab open, as their Web Locks tell */
  present: Set<string>
}

/** The push side of a browser: one subscription, a new endpoint each time */
function installBrowserPush(ready?: Promise<unknown>): BrowserPush {
  let subscription: FakeSubscription | null = null
  let count = 0
  const registered: string[] = []
  const present = new Set<string>()
  const registration = {
    pushManager: {
      getSubscription: () => Promise.resolve(subscription),
      subscribe: (options: {
        applicationServerKey?: Uint8Array<ArrayBuffer>
      }) => {
        count += 1
        const created: FakeSubscription = {
          endpoint: `https://push.example.com/${String(count)}`,
          options: {
            applicationServerKey: options.applicationServerKey?.buffer ?? null
          },
          unsubscribe: jest.fn(() => {
            subscription = null
            return Promise.resolve(true)
          }),
          toJSON: () => ({ keys: { p256dh: 'cDI1Ng', auth: 'YXV0aA' } })
        }
        subscription = created
        return Promise.resolve(created)
      }
    }
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: (url: string) => {
        registered.push(url)
        return Promise.resolve(registration)
      },
      ready: ready ?? Promise.resolve(registration),
      getRegistration: () => Promise.resolve(registration)
    }
  })
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (
        _name: string,
        optionsOrCallback: unknown,
        callback?: () => Promise<void>
      ) =>
        (typeof optionsOrCallback === 'function'
          ? (optionsOrCallback as () => Promise<void>)
          : (callback as () => Promise<void>))(),
      query: () =>
        Promise.resolve({
          held: [...present].map(name => ({
            name: `twake-mail-web-push-account:${name}`
          }))
        })
    }
  })
  Object.defineProperty(globalThis, 'PushManager', {
    configurable: true,
    value: {}
  })
  return { registered, current: () => subscription, present }
}

interface SetArgs {
  create?: Record<string, Record<string, unknown>>
  update?: Record<string, Record<string, unknown>>
  destroy?: string[]
}

interface Account {
  client: JmapClient
  session: Session
  server: FakeJmapServer
  /** The `PushSubscription/set` calls the server got, in order */
  calls: SetArgs[]
  /** The subscriptions the server keeps */
  ids: Set<string>
  /** Called when the server creates a subscription, before it answers */
  onCreate: { current: ((id: string) => void) | null }
}

let accounts = 0

async function makeAccount(
  username: string | null = null,
  capabilities: Record<string, unknown> = {
    [WEBPUSH_VAPID_CAPABILITY]: { applicationServerKey: SERVER_KEY }
  }
): Promise<Account> {
  accounts += 1
  const prefix = `ps${String(accounts)}-`
  const server = makeFakeJmapServer({ capabilities })
  const client = createClient({
    sessionUrl: FAKE_SESSION_URL,
    auth: { getAuthorizationHeader: () => Promise.resolve('Basic dGVzdA==') },
    fetch: server.fetch,
    methodCapabilities: METHOD_CAPABILITIES
  })
  const session = await client.getSession()
  const calls: SetArgs[] = []
  const ids = new Set<string>()
  const onCreate: Account['onCreate'] = { current: null }
  server.handlers.set('PushSubscription/set', args => {
    const set = args as SetArgs
    calls.push(set)
    const created: Record<string, { id: string }> = {}
    const notUpdated: Record<string, { type: string }> = {}
    for (const key of Object.keys(set.create ?? {})) {
      const id = `${prefix}${String(calls.length)}`
      ids.add(id)
      created[key] = { id }
      onCreate.current?.(id)
    }
    for (const id of Object.keys(set.update ?? {})) {
      if (!ids.has(id)) notUpdated[id] = { type: 'notFound' }
    }
    for (const id of set.destroy ?? []) ids.delete(id)
    return {
      created,
      updated: null,
      destroyed: set.destroy ?? [],
      notCreated: null,
      notUpdated: Object.keys(notUpdated).length > 0 ? notUpdated : null,
      notDestroyed: null
    }
  })
  return {
    client,
    session: username === null ? session : { ...session, username },
    server,
    calls,
    ids,
    onCreate
  }
}

/** Subscribes, then sends the verification code back as the page does */
async function subscribeVerified(account: Account): Promise<string> {
  await syncWebPush(account.client, account.session, true, TEXTS)
  const id = [...account.ids].at(-1) ?? ''
  await confirmWebPush(account.client, account.session.username, id, 'code')
  return id
}

describe('syncWebPush', () => {
  beforeEach(() => {
    accounts = 0
  })

  afterEach(async () => {
    jest.useRealTimers()
    await endWebPush()
    window.localStorage.clear()
    Reflect.deleteProperty(navigator, 'serviceWorker')
    Reflect.deleteProperty(navigator, 'locks')
    Reflect.deleteProperty(globalThis, 'PushManager')
  })

  it('subscribes the browser to the deliveries of emails, signed by the key of the server', async () => {
    const browser = installBrowserPush()
    const { client, session, calls } = await makeAccount()

    await syncWebPush(client, session, true, TEXTS)

    expect(browser.registered).toEqual([
      '/push-worker.js?title=New+email&body=Open+Twake+Mail+to+read+it.'
    ])
    expect(
      new Uint8Array(browser.current()?.options.applicationServerKey ?? [])
    ).toHaveLength(65)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.create?.push).toEqual({
      deviceClientId: expect.any(String) as string,
      url: 'https://push.example.com/1',
      keys: { p256dh: 'cDI1Ng', auth: 'YXV0aA' },
      types: ['EmailDelivery']
    })
  })

  it('renews the subscription it verified, without a new one', async () => {
    installBrowserPush()
    const account = await makeAccount()
    const id = await subscribeVerified(account)

    await syncWebPush(account.client, account.session, true, TEXTS)

    expect(account.calls[1]).toEqual({
      update: { [id]: { verificationCode: 'code' } }
    })
    expect(account.calls).toHaveLength(3)
    expect(account.calls[2]?.create).toBe(undefined)
    expect(account.calls[2]?.update?.[id]?.expires).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    )
  })

  it('subscribes again when the server lost the subscription', async () => {
    installBrowserPush()
    const account = await makeAccount()
    await subscribeVerified(account)
    account.ids.clear()

    await syncWebPush(account.client, account.session, true, TEXTS)

    expect(account.calls[3]?.create?.push?.url).toBe(
      'https://push.example.com/1'
    )
  })

  it('replaces a subscription whose verification code never came', async () => {
    installBrowserPush()
    const { client, session, calls } = await makeAccount()
    await syncWebPush(client, session, true, TEXTS)

    await syncWebPush(client, session, true, TEXTS)

    expect(calls[1]?.destroy).toEqual(['ps1-1'])
    expect(calls[1]?.create?.push?.url).toBe('https://push.example.com/1')
  })

  it('sends back a verification code that came before the creation was answered', async () => {
    installBrowserPush()
    const account = await makeAccount()
    const { client, session, calls } = account
    // As the server does: the code is pushed while the creation runs
    account.onCreate.current = id => {
      void confirmWebPush(client, session.username, id, 'early')
    }

    await syncWebPush(client, session, true, TEXTS)

    expect(calls[1]).toEqual({
      update: { 'ps1-1': { verificationCode: 'early' } }
    })
    account.onCreate.current = null
    await syncWebPush(client, session, true, TEXTS)
    // Verified: renewed, not replaced
    expect(calls[2]?.create).toBe(undefined)
  })

  it('leaves the verification code of another subscription alone', async () => {
    installBrowserPush()
    const { client, session, calls } = await makeAccount()
    await syncWebPush(client, session, true, TEXTS)

    await confirmWebPush(client, session.username, 'not-mine', 'code')

    expect(calls).toHaveLength(1)
  })

  it('removes the subscription when notifications are turned off', async () => {
    const browser = installBrowserPush()
    const { client, session, calls } = await makeAccount()
    await syncWebPush(client, session, true, TEXTS)
    const subscription = browser.current()

    await syncWebPush(client, session, false, TEXTS)

    expect(subscription?.unsubscribe).toHaveBeenCalledTimes(1)
    expect(calls[1]).toEqual({ destroy: ['ps1-1'] })
  })

  it('removes the subscription before signing out', async () => {
    const browser = installBrowserPush()
    const { client, session, calls } = await makeAccount()
    await syncWebPush(client, session, true, TEXTS)

    await endWebPush()

    expect(browser.current()).toBe(null)
    expect(calls[1]).toEqual({ destroy: ['ps1-1'] })
  })

  it('never keeps the user signed in while the server does not answer', async () => {
    installBrowserPush()
    const { client, session, server } = await makeAccount()
    await syncWebPush(client, session, true, TEXTS)
    const release = server.holdRequests('PushSubscription/set')
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.useFakeTimers()

    let isDone = false
    const ending = endWebPush().then(() => {
      isDone = true
    })
    await jest.advanceTimersByTimeAsync(2900)
    expect(isDone).toBe(false)
    await jest.advanceTimersByTimeAsync(200)
    await ending

    expect(isDone).toBe(true)
    release()
  })

  it('gives the endpoint up without the server when the session was lost', async () => {
    const browser = installBrowserPush()
    const { client, session, calls } = await makeAccount()
    await syncWebPush(client, session, true, TEXTS)

    await forgetWebPush(session.username)
    await endWebPush()

    expect(browser.current()).toBe(null)
    expect(calls).toHaveLength(1)
  })

  it('replaces the endpoint left by an account that is gone', async () => {
    const browser = installBrowserPush()
    const gone = await makeAccount()
    await subscribeVerified(gone)
    const next = await makeAccount(OTHER)

    await syncWebPush(next.client, next.session, true, TEXTS)

    expect(browser.current()?.endpoint).toBe('https://push.example.com/2')
    expect(next.calls).toHaveLength(1)
    expect(next.calls[0]?.create?.push?.url).toBe('https://push.example.com/2')
    // Never the subscription of the other account on the server
    expect(next.calls[0]?.destroy).toBe(undefined)
    expect(
      Object.keys(
        JSON.parse(
          window.localStorage.getItem('twake-mail.push.subscriptions') ?? '{}'
        ) as object
      )
    ).toEqual([OTHER])
  })

  it('shares the endpoint with an account that has a tab open', async () => {
    const browser = installBrowserPush()
    const first = await makeAccount()
    const firstId = await subscribeVerified(first)
    browser.present.add(first.session.username)
    const second = await makeAccount(OTHER)

    await syncWebPush(second.client, second.session, true, TEXTS)

    expect(browser.current()?.endpoint).toBe('https://push.example.com/1')
    expect(second.calls[0]?.create?.push?.url).toBe(
      'https://push.example.com/1'
    )
    // The first account keeps its own: renewed, not replaced
    browser.present.add(OTHER)
    await syncWebPush(first.client, first.session, true, TEXTS)
    expect(first.calls.at(-1)).toEqual({
      update: { [firstId]: { expires: expect.any(String) as string } }
    })
  })

  it('keeps the endpoint for the other account when one turns the push off', async () => {
    const browser = installBrowserPush()
    const first = await makeAccount()
    await subscribeVerified(first)
    browser.present.add(first.session.username)
    const second = await makeAccount(OTHER)
    await syncWebPush(second.client, second.session, true, TEXTS)
    const subscription = browser.current()

    await syncWebPush(second.client, second.session, false, TEXTS)
    expect(subscription?.unsubscribe).not.toHaveBeenCalled()
    expect(second.calls.at(-1)).toEqual({ destroy: ['ps2-1'] })

    await syncWebPush(first.client, first.session, false, TEXTS)
    expect(subscription?.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('replaces a subscription made for another key of the server', async () => {
    const browser = installBrowserPush()
    const account = await makeAccount()
    await subscribeVerified(account)
    const rekeyed = await makeAccount(account.session.username, {})

    await syncWebPush(rekeyed.client, rekeyed.session, true, TEXTS)

    expect(browser.current()?.endpoint).toBe('https://push.example.com/2')
    expect(browser.current()?.options.applicationServerKey).toBe(null)
  })

  it('asks for an unsigned subscription when the server has no key', async () => {
    const browser = installBrowserPush()
    const { client, session, calls } = await makeAccount(null, {})

    await syncWebPush(client, session, true, TEXTS)

    expect(browser.current()?.options.applicationServerKey).toBe(null)
    expect(calls).toHaveLength(1)
  })

  it('gives up, and lets the other tabs go, when the worker never gets ready', async () => {
    installBrowserPush(new Promise(() => undefined))
    const { client, session, calls } = await makeAccount()
    jest.useFakeTimers()

    let failure: unknown = null
    const syncing = syncWebPush(client, session, true, TEXTS).catch(
      (error: unknown) => {
        failure = error
      }
    )
    await jest.advanceTimersByTimeAsync(10_000)
    await syncing

    expect(String(failure)).toContain('The worker took more')
    expect(calls).toHaveLength(0)
  })

  it('does nothing in a browser without web push', async () => {
    const { client, session, calls } = await makeAccount()

    await syncWebPush(client, session, true, TEXTS)

    expect(calls).toHaveLength(0)
  })
})
