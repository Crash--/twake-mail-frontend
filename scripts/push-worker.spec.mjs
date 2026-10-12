import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const SOURCE = readFileSync(
  new URL('../public/push-worker.js', import.meta.url),
  'utf8'
)

/** Runs `public/push-worker.js` in a fake service worker scope */
function loadWorker(pages = []) {
  const listeners = {}
  const shown = []
  const opened = []
  const self = {
    location: {
      href: 'https://mail.example.com/push-worker.js?title=T&body=B'
    },
    addEventListener: (type, listener) => {
      listeners[type] = listener
    },
    skipWaiting: () => Promise.resolve(),
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(pages),
      openWindow: url => {
        opened.push(url)
        return Promise.resolve(null)
      }
    },
    registration: {
      showNotification: (title, options) => {
        shown.push({ title, ...options })
        return Promise.resolve()
      }
    }
  }
  vm.runInNewContext(SOURCE, {
    self,
    URL,
    MessageChannel,
    setTimeout: callback => setTimeout(callback, 20),
    clearTimeout
  })
  const dispatch = async (type, event) => {
    let done = Promise.resolve()
    listeners[type]({
      ...event,
      waitUntil: promise => {
        done = promise
      }
    })
    await done
  }
  return { shown, opened, dispatch }
}

function makePage({ answers = false, focused = false } = {}) {
  const page = {
    focused,
    messages: [],
    hasFocus: false,
    postMessage: (message, ports = []) => {
      // Copied: the worker runs in another realm, with its own prototypes
      page.messages.push(JSON.parse(JSON.stringify(message)))
      if (answers) ports[0]?.postMessage('shown')
    },
    focus: () => {
      page.hasFocus = true
      return Promise.resolve(page)
    }
  }
  return page
}

const stateChange = {
  json: () => ({
    '@type': 'StateChange',
    changed: { a1: { EmailDelivery: 's' } }
  })
}

test('with every tab closed, a push shows the notification of the worker', async () => {
  const worker = loadWorker()

  await worker.dispatch('push', { data: stateChange })

  assert.equal(worker.shown.length, 1)
  assert.equal(worker.shown[0].title, 'T')
  assert.equal(worker.shown[0].body, 'B')
})

test('a page that shows the new emails keeps the worker quiet', async () => {
  const page = makePage({ answers: true })
  const worker = loadWorker([page])

  await worker.dispatch('push', { data: stateChange })

  assert.deepEqual(page.messages, [{ type: 'twake-mail-push' }])
  assert.equal(worker.shown.length, 0)
})

test('a page that does not answer leaves the notification to the worker', async () => {
  const worker = loadWorker([makePage()])

  await worker.dispatch('push', { data: stateChange })

  assert.equal(worker.shown.length, 1)
})

test('the verification code goes to the pages, without a notification', async () => {
  const page = makePage()
  const worker = loadWorker([page])

  await worker.dispatch('push', {
    data: {
      json: () => ({
        '@type': 'PushVerification',
        pushSubscriptionId: 'ps1',
        verificationCode: 'code'
      })
    }
  })

  assert.deepEqual(page.messages, [
    {
      type: 'twake-mail-push-verification',
      pushSubscriptionId: 'ps1',
      verificationCode: 'code'
    }
  ])
  assert.equal(worker.shown.length, 0)
})

test('a click opens the email in the focused page of the app', async () => {
  const other = makePage()
  const front = makePage({ focused: true })
  const worker = loadWorker([other, front])
  let isClosed = false

  await worker.dispatch('notificationclick', {
    notification: {
      data: { url: '/mailbox/in/email/e1' },
      close: () => {
        isClosed = true
      }
    }
  })

  assert.equal(isClosed, true)
  assert.deepEqual(front.messages, [
    { type: 'twake-mail-open', url: '/mailbox/in/email/e1' }
  ])
  assert.equal(front.hasFocus, true)
  assert.deepEqual(other.messages, [])
})

test('a click opens the app when no page is left', async () => {
  const worker = loadWorker()

  await worker.dispatch('notificationclick', {
    notification: { data: { url: '/' }, close: () => undefined }
  })

  assert.deepEqual(worker.opened, ['/'])
})
