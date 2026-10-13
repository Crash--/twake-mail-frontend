/*
 * Service worker of the web push of new emails (JMAP PushSubscription,
 * RFC 8620 §7.2). It holds no credentials: a push only says that the state
 * of an account changed. A page of the app that alerts for that account
 * reads the new emails and shows them (sender, subject); without one, the
 * notification says no more than "new email". Its texts come in the URL of
 * the script, in the language of the user.
 *
 * The messages to the pages are `PushWorkerMessage` of
 * `common/src/features/newMail/webPush.ts`.
 */
const params = new URL(self.location.href).searchParams
const TITLE = params.get('title') ?? 'Twake Mail'
const BODY = params.get('body') ?? ''
/** `GENERIC_NOTIFICATION_TAG` of webPush.ts */
const GENERIC_TAG = 'twake-mail-new-mail'
/** How long a page has to say that it reads the new emails */
const PAGE_ANSWER_MS = 4000
/** How long it then has to show them */
const PAGE_READ_MS = 20000
/** How long a page has to take the email of a clicked notification */
const PAGE_OPEN_MS = 1000

self.addEventListener('install', () => {
  void self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

/** The tabs of the origin, not the frames: the app alone, or any other page */
async function listPages() {
  const pages = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  return pages.filter(page => page.frameType !== 'nested')
}

/**
 * Asks the pages to show the new emails of these accounts. Resolves true
 * once one did; false when none takes it in time, or the one reading fails.
 */
function askPages(pages, accountIds) {
  if (pages.length === 0) return Promise.resolve(false)
  return new Promise(resolve => {
    const ports = []
    let timer = null
    const finish = isShown => {
      clearTimeout(timer)
      for (const port of ports) port.close()
      resolve(isShown)
    }
    const wait = ms => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        finish(false)
      }, ms)
    }
    wait(PAGE_ANSWER_MS)
    for (const page of pages) {
      const channel = new MessageChannel()
      ports.push(channel.port1)
      channel.port1.onmessage = event => {
        if (event.data === 'reading') wait(PAGE_READ_MS)
        else finish(event.data === 'shown')
      }
      page.postMessage({ type: 'twake-mail-push', accountIds }, [channel.port2])
    }
  })
}

async function handlePush(data) {
  let message = null
  try {
    message = data === null ? null : data.json()
  } catch {
    // Not JSON: handled as a change of state of an unknown account
  }
  const pages = await listPages()
  if (message !== null && message['@type'] === 'PushVerification') {
    // The page that created the subscription confirms it to the server
    for (const page of pages) {
      page.postMessage({
        type: 'twake-mail-push-verification',
        pushSubscriptionId: message.pushSubscriptionId,
        verificationCode: message.verificationCode
      })
    }
    return
  }
  const changed = message !== null ? message.changed : null
  const accountIds =
    changed !== null && typeof changed === 'object'
      ? Object.keys(changed)
      : null
  if (await askPages(pages, accountIds)) return
  await self.registration.showNotification(TITLE, {
    body: BODY,
    tag: GENERIC_TAG,
    renotify: true,
    icon: '/icons/Icon-192.png',
    data: { url: '/', accountId: null }
  })
}

self.addEventListener('push', event => {
  event.waitUntil(handlePush(event.data))
})

/** Resolves whether this page took the email: only a page of the app does */
function askToOpen(page, url, accountId) {
  return new Promise(resolve => {
    const channel = new MessageChannel()
    const finish = isOpened => {
      clearTimeout(timer)
      channel.port1.close()
      resolve(isOpened)
    }
    const timer = setTimeout(() => {
      finish(false)
    }, PAGE_OPEN_MS)
    channel.port1.onmessage = () => {
      finish(true)
    }
    page.postMessage({ type: 'twake-mail-open', url, accountId }, [
      channel.port2
    ])
  })
}

/** The email opens in one tab of its account, the one in front first */
async function openApp(url, accountId) {
  const pages = await listPages()
  const rank = page =>
    page.focused ? 0 : page.visibilityState === 'visible' ? 1 : 2
  pages.sort((one, other) => rank(one) - rank(other))
  // One at a time: a page that takes the email navigates to it
  for (const page of pages) {
    if (await askToOpen(page, url, accountId)) {
      await page.focus()
      return
    }
  }
  await self.clients.openWindow(url)
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const data = event.notification.data ?? {}
  const url = typeof data.url === 'string' ? data.url : '/'
  const accountId = typeof data.accountId === 'string' ? data.accountId : null
  event.waitUntil(openApp(url, accountId))
})
