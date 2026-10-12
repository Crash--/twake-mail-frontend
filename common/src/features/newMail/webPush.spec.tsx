import { createClient, type JmapClient, type Session } from 'jmap-client-ts'

import {
  METHOD_CAPABILITIES,
  WEBPUSH_VAPID_CAPABILITY
} from '@common/jmap/pushSubscription'
import {
  FAKE_SESSION_URL,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'

import { confirmWebPush, endWebPush, syncWebPush } from './webPush'

const TEXTS = { title: 'New email', body: 'An email reached your Inbox.' }
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

/** The push side of a browser: one subscription, a new endpoint each time */
function installBrowserPush(): {
  registered: string[]
  current: () => FakeSubscription | null
} {
  let subscription: FakeSubscription | null = null
  let count = 0
  const registered: string[] = []
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
      ready: Promise.resolve(registration),
      getRegistration: () => Promise.resolve(registration)
    }
  })
  Object.defineProperty(globalThis, 'PushManager', {
    configurable: true,
    value: {}
  })
  return { registered, current: () => subscription }
}

interface SetArgs {
  create?: Record<string, Record<string, unknown>>
  update?: Record<string, Record<string, unknown>>
  destroy?: string[]
}

/** A server keeping the push subscriptions it is asked for */
function servePushSubscriptions(server: FakeJmapServer): {
  calls: SetArgs[]
  ids: Set<string>
} {
  const calls: SetArgs[] = []
  const ids = new Set<string>()
  server.handlers.set('PushSubscription/set', args => {
    const set = args as SetArgs
    calls.push(set)
    const created: Record<string, { id: string }> = {}
    const updated: Record<string, null> = {}
    const notUpdated: Record<string, { type: string }> = {}
    for (const key of Object.keys(set.create ?? {})) {
      const id = `ps${String(calls.length)}`
      ids.add(id)
      created[key] = { id }
    }
    for (const id of Object.keys(set.update ?? {})) {
      if (ids.has(id)) updated[id] = null
      else notUpdated[id] = { type: 'notFound' }
    }
    for (const id of set.destroy ?? []) ids.delete(id)
    return {
      created,
      updated,
      destroyed: set.destroy ?? [],
      notCreated: null,
      notUpdated: Object.keys(notUpdated).length > 0 ? notUpdated : null,
      notDestroyed: null
    }
  })
  return { calls, ids }
}

async function makeClient(
  capabilities: Record<string, unknown> = {
    [WEBPUSH_VAPID_CAPABILITY]: { applicationServerKey: SERVER_KEY }
  }
): Promise<{
  client: JmapClient
  session: Session
  calls: SetArgs[]
  ids: Set<string>
}> {
  const server = makeFakeJmapServer({ capabilities })
  const client = createClient({
    sessionUrl: FAKE_SESSION_URL,
    auth: { getAuthorizationHeader: () => Promise.resolve('Basic dGVzdA==') },
    fetch: server.fetch,
    methodCapabilities: METHOD_CAPABILITIES
  })
  const session = await client.getSession()
  return { client, session, ...servePushSubscriptions(server) }
}

describe('syncWebPush', () => {
  afterEach(() => {
    window.localStorage.clear()
    Reflect.deleteProperty(navigator, 'serviceWorker')
    Reflect.deleteProperty(globalThis, 'PushManager')
  })

  it('subscribes the browser to the deliveries of emails, signed by the key of the server', async () => {
    const browser = installBrowserPush()
    const { client, session, calls } = await makeClient()

    await syncWebPush(client, session, true, TEXTS)

    expect(browser.registered).toEqual([
      '/push-worker.js?title=New+email&body=An+email+reached+your+Inbox.'
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
    const { client, session, calls } = await makeClient()
    await syncWebPush(client, session, true, TEXTS)
    await confirmWebPush(client, 'ps1', 'code')

    await syncWebPush(client, session, true, TEXTS)

    expect(calls[1]).toEqual({ update: { ps1: { verificationCode: 'code' } } })
    expect(calls).toHaveLength(3)
    expect(calls[2]?.create).toBe(undefined)
    expect(calls[2]?.update?.ps1?.expires).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    )
  })

  it('subscribes again when the server lost the subscription', async () => {
    installBrowserPush()
    const { client, session, calls, ids } = await makeClient()
    await syncWebPush(client, session, true, TEXTS)
    await confirmWebPush(client, 'ps1', 'code')
    ids.clear()

    await syncWebPush(client, session, true, TEXTS)

    expect(calls[3]?.create?.push?.url).toBe('https://push.example.com/1')
  })

  it('replaces a subscription whose verification code never came', async () => {
    installBrowserPush()
    const { client, session, calls } = await makeClient()
    await syncWebPush(client, session, true, TEXTS)

    await syncWebPush(client, session, true, TEXTS)

    expect(calls[1]?.destroy).toEqual(['ps1'])
    expect(calls[1]?.create?.push?.url).toBe('https://push.example.com/1')
  })

  it('removes the subscription when notifications are turned off', async () => {
    const browser = installBrowserPush()
    const { client, session, calls } = await makeClient()
    await syncWebPush(client, session, true, TEXTS)
    const subscription = browser.current()

    await syncWebPush(client, session, false, TEXTS)

    expect(subscription?.unsubscribe).toHaveBeenCalledTimes(1)
    expect(calls[1]).toEqual({ destroy: ['ps1'] })
  })

  it('removes the subscription before signing out', async () => {
    const browser = installBrowserPush()
    const { client, session, calls } = await makeClient()
    await syncWebPush(client, session, true, TEXTS)

    await endWebPush()

    expect(browser.current()).toBe(null)
    expect(calls[1]).toEqual({ destroy: ['ps1'] })
  })

  it('gives up the endpoint of another account of this browser', async () => {
    const browser = installBrowserPush()
    const first = await makeClient()
    await syncWebPush(first.client, first.session, true, TEXTS)
    const other = await makeClient()

    await syncWebPush(
      other.client,
      { ...other.session, username: 'someone-else@example.com' },
      true,
      TEXTS
    )

    expect(browser.current()?.endpoint).toBe('https://push.example.com/2')
    expect(other.calls).toHaveLength(1)
    expect(other.calls[0]?.create?.push?.url).toBe('https://push.example.com/2')
    // Never the subscription of the other account on the server
    expect(other.calls[0]?.destroy).toBe(undefined)
  })

  it('asks for an unsigned subscription when the server has no key', async () => {
    const browser = installBrowserPush()
    const { client, session, calls } = await makeClient({})

    await syncWebPush(client, session, true, TEXTS)

    expect(browser.current()?.options.applicationServerKey).toBe(null)
    expect(calls).toHaveLength(1)
  })

  it('does nothing in a browser without web push', async () => {
    const { client, session, calls } = await makeClient()

    await syncWebPush(client, session, true, TEXTS)

    expect(calls).toHaveLength(0)
  })
})
