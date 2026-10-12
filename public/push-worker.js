/*
 * Service worker of the web push of new emails (JMAP PushSubscription,
 * RFC 8620 §7.2). It holds no credentials: a push only says that the state
 * of the account changed. A page of the app that alerts reads the new
 * emails and shows them (sender, subject); without one, the notification
 * says no more than "new email". Its texts come in the URL of the script,
 * in the language of the user.
 */
const params = new URL(self.location.href).searchParams
const TITLE = params.get('title') ?? 'Twake Mail'
const BODY = params.get('body') ?? ''
const GENERIC_TAG = 'twake-mail-new-mail'
/** How long a page has to show the new emails itself */
const PAGE_ANSWER_MS = 4000

self.addEventListener('install', () => {
  void self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

function listPages() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
}

/** Resolves true once a page answered that it showed the new emails */
function askPages(pages) {
  if (pages.length === 0) return Promise.resolve(false)
  return new Promise(resolve => {
    const ports = []
    const finish = isShown => {
      clearTimeout(timer)
      for (const port of ports) port.close()
      resolve(isShown)
    }
    const timer = setTimeout(() => {
      finish(false)
    }, PAGE_ANSWER_MS)
    for (const page of pages) {
      const channel = new MessageChannel()
      ports.push(channel.port1)
      channel.port1.onmessage = () => {
        finish(true)
      }
      page.postMessage({ type: 'twake-mail-push' }, [channel.port2])
    }
  })
}

async function handlePush(data) {
  let message = null
  try {
    message = data === null ? null : data.json()
  } catch {
    // Not JSON: handled as a change of state
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
  if (await askPages(pages)) return
  await self.registration.showNotification(TITLE, {
    body: BODY,
    tag: GENERIC_TAG,
    renotify: true,
    icon: '/icons/Icon-192.png',
    data: { url: '/' }
  })
}

self.addEventListener('push', event => {
  event.waitUntil(handlePush(event.data))
})

async function openApp(url) {
  const pages = await listPages()
  const page = pages.find(candidate => candidate.focused) ?? pages[0]
  if (page === undefined) {
    await self.clients.openWindow(url)
    return
  }
  page.postMessage({ type: 'twake-mail-open', url })
  await page.focus()
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const data = event.notification.data
  const url = data && typeof data.url === 'string' ? data.url : '/'
  event.waitUntil(openApp(url))
})
