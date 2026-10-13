import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { expect, type BrowserContext, type Page } from '@playwright/test'

import { env } from './env'

/**
 * The web push of the suite. Chromium, as Playwright runs it, has no push
 * service: `PushManager.subscribe` fails. The specs stand in for it:
 *
 *   James ──POST──▶ PushService (this file, on the test runner)
 *                      └──▶ the service worker of the app (DevTools protocol)
 *
 * so the subscription, its verification and every push really go through
 * tmail-backend. The browser is given a subscription without keys, which
 * James then pushes to in clear text (RFC 8620 §7.2).
 */

/** A push James sent to the push service */
export interface ReceivedPush {
  /** Path of the endpoint it was posted to */
  path: string
  /** Its JSON body (`StateChange` or `PushVerification`), null when it is not JSON */
  body: Record<string, unknown> | null
  raw: string
  headers: Record<string, string | string[] | undefined>
}

/** Where James reaches the test runner from its container (docker-compose.yaml) */
const PUSH_HOST = process.env.E2E_PUSH_HOST ?? 'host.docker.internal'

/** What the app is told by its fake `PushManager` (see `givePushManager`) */
const ENDPOINT_KEY = 'e2e.push.endpoint'
const COUNT_KEY = 'e2e.push.count'

export class PushService {
  readonly #server: Server
  readonly #token = randomUUID()
  readonly pushes: ReceivedPush[] = []
  /** Pushes the service could not hand to the worker: a test fails on any */
  readonly failures: string[] = []
  #deliver: ((push: ReceivedPush) => Promise<void>) | null = null

  private constructor(server: Server) {
    this.#server = server
    server.on('request', (request, response) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('end', () => {
        // Another test's push, or anything else: not ours
        if (!(request.url ?? '').startsWith(`/${this.#token}/`)) {
          response.writeHead(404).end()
          return
        }
        const raw = Buffer.concat(chunks).toString('utf8')
        let body: Record<string, unknown> | null = null
        try {
          body = JSON.parse(raw) as Record<string, unknown>
        } catch {
          // Kept as it came
        }
        const push = {
          path: request.url ?? '',
          body,
          raw,
          headers: request.headers
        }
        this.pushes.push(push)
        // As a push service: accepted, then delivered when the browser is there
        response.writeHead(201).end()
        this.#deliver?.(push).catch((error: unknown) => {
          this.failures.push(`${raw}: ${String(error)}`)
        })
      })
    })
  }

  /** Starts a push service for one test: `await using` is not used, call `stop()` */
  static async start(): Promise<PushService> {
    const server = createServer()
    // Reached from the James container, through the gateway of its network
    await new Promise<void>(resolve => server.listen(0, '0.0.0.0', resolve))
    return new PushService(server)
  }

  /** The endpoints the browser gets: `<base>/<n>`, a new one per subscription */
  get endpointBase(): string {
    const { port } = this.#server.address() as AddressInfo
    return `http://${PUSH_HOST}:${String(port)}/${this.#token}`
  }

  /** The pushes of one kind James sent so far */
  of(type: 'StateChange' | 'PushVerification'): ReceivedPush[] {
    return this.pushes.filter(push => push.body?.['@type'] === type)
  }

  /**
   * Gives the browser a push subscription to this service, whatever page
   * asks: call before the app loads.
   */
  async givePushManager(context: BrowserContext): Promise<void> {
    await context.addInitScript(
      ({ base, endpointKey, countKey }) => {
        if (typeof PushManager === 'undefined') return
        const make = (endpoint: string): PushSubscription =>
          ({
            endpoint,
            expirationTime: null,
            options: { applicationServerKey: null, userVisibleOnly: true },
            getKey: () => null,
            // No keys: James pushes in clear text
            toJSON: () => ({ endpoint }),
            unsubscribe: () => {
              window.localStorage.removeItem(endpointKey)
              return Promise.resolve(true)
            }
          }) as unknown as PushSubscription
        PushManager.prototype.getSubscription = () => {
          const endpoint = window.localStorage.getItem(endpointKey)
          return Promise.resolve(endpoint === null ? null : make(endpoint))
        }
        PushManager.prototype.subscribe = () => {
          const count = Number(window.localStorage.getItem(countKey) ?? '0') + 1
          const endpoint = `${base}/${String(count)}`
          window.localStorage.setItem(countKey, String(count))
          window.localStorage.setItem(endpointKey, endpoint)
          return Promise.resolve(make(endpoint))
        }
      },
      {
        base: this.endpointBase,
        endpointKey: ENDPOINT_KEY,
        countKey: COUNT_KEY
      }
    )
  }

  /**
   * From now on, what James pushes reaches the service worker of the app,
   * through `page` (any page of the origin, which must stay open).
   */
  async deliverThrough(page: Page): Promise<void> {
    const cdp = await page.context().newCDPSession(page)
    let registrationId: string | null = null
    cdp.on('ServiceWorker.workerRegistrationUpdated', event => {
      const registration = event.registrations.find(
        one => !one.isDeleted && one.scopeURL.startsWith(env.baseUrl)
      )
      if (registration !== undefined) {
        registrationId = registration.registrationId
      }
    })
    await cdp.send('ServiceWorker.enable')
    this.#deliver = async push => {
      // The worker is registered before the app subscribes
      await expect.poll(() => registrationId).not.toBe(null)
      await cdp.send('ServiceWorker.deliverPushMessage', {
        origin: env.baseUrl,
        registrationId: registrationId ?? '',
        data: push.raw
      })
    }
  }

  async stop(): Promise<void> {
    this.#deliver = null
    await new Promise<void>(resolve => {
      this.#server.close(() => {
        resolve()
      })
      this.#server.closeAllConnections()
    })
  }
}

/** A notification the service worker of the app shows */
export interface ShownNotification {
  title: string
  body: string
  tag: string
  data: unknown
}

/** The notifications shown now, read from a page of the app origin */
export async function shownNotifications(
  page: Page
): Promise<ShownNotification[]> {
  return page.evaluate(async () => {
    const registration =
      await navigator.serviceWorker.getRegistration('/push-worker.js')
    const notifications = (await registration?.getNotifications()) ?? []
    return notifications.map(({ title, body, tag, data }) => ({
      title,
      body,
      tag,
      data: data as unknown
    }))
  })
}

/**
 * The user clicks a notification: its `notificationclick` runs in the
 * worker. Without a real click the browser lets the worker neither focus a
 * tab nor open one: what the page does with the click is what shows.
 */
export async function clickNotification(
  context: BrowserContext,
  tag: string
): Promise<void> {
  const worker = context
    .serviceWorkers()
    .find(one => one.url().includes('/push-worker.js'))
  if (worker === undefined) throw new Error('No push worker in this browser')
  await worker.evaluate(async wanted => {
    // The types of a worker scope are not loaded with those of the pages
    const scope = self as unknown as {
      registration: ServiceWorkerRegistration
      dispatchEvent: (event: Event) => boolean
      NotificationEvent: new (
        type: string,
        init: { notification: Notification }
      ) => Event
    }
    const [notification] = await scope.registration.getNotifications({
      tag: wanted
    })
    if (notification === undefined) {
      throw new Error(`No notification tagged ${wanted}`)
    }
    scope.dispatchEvent(
      new scope.NotificationEvent('notificationclick', { notification })
    )
  }, tag)
}

/**
 * The page stops counting as the one in front, as when the user looks at
 * another window: the app only notifies then. Playwright keeps every page
 * focused and visible.
 */
export async function putInBackground(page: Page): Promise<void> {
  await page.evaluate(() => {
    Document.prototype.hasFocus = () => false
  })
}

/** Where the fake `PushManager` says the browser is subscribed, null when it is not */
export async function browserEndpoint(page: Page): Promise<string | null> {
  return page.evaluate(key => window.localStorage.getItem(key), ENDPOINT_KEY)
}

/**
 * As if the app had been closed for a while: the subscriptions it remembers
 * (common/src/features/newMail/webPush.ts) are old, so the verification
 * code of one never verified is no longer waited for.
 */
export async function ageSubscriptions(page: Page): Promise<void> {
  await page.evaluate(() => {
    const key = 'twake-mail.push.subscriptions'
    const records = JSON.parse(
      window.localStorage.getItem(key) ?? '{}'
    ) as Record<string, { createdAt: number }>
    for (const record of Object.values(records)) record.createdAt = 0
    window.localStorage.setItem(key, JSON.stringify(records))
  })
}
