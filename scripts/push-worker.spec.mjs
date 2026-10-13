import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const SOURCE = readFileSync(
  new URL('../public/push-worker.js', import.meta.url),
  'utf8'
)

/**
 * Runs `public/push-worker.js` in a fake service worker scope, its waits
 * 100 times shorter
 */
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
      matchAll: () => Promise.resolve([...pages]),
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
    setTimeout: (callback, ms) => setTimeout(callback, ms / 100),
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

/**
 * A tab of the origin. `answers`: what it says on the port of a message,
 * in order, each after `delay` ms.
 */
function makePage({
  answers = [],
  delay = 0,
  focused = false,
  visibilityState = 'hidden',
  frameType = 'top-level'
} = {}) {
  const page = {
    focused,
    visibilityState,
    frameType,
    messages: [],
    hasFocus: false,
    postMessage: (message, ports = []) => {
      // Copied: the worker runs in another realm, with its own prototypes
      page.messages.push(JSON.parse(JSON.stringify(message)))
      let wait = Promise.resolve()
      for (const answer of answers) {
        wait = wait
          .then(() => new Promise(resolve => setTimeout(resolve, delay)))
          .then(() => ports[0]?.postMessage(answer))
      }
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

const click = (data, onClose = () => undefined) => ({
  notification: { data, close: onClose }
})

test('with every tab closed, a push shows the notification of the worker', async () => {
  const worker = loadWorker()

  await worker.dispatch('push', { data: stateChange })

  assert.equal(worker.shown.length, 1)
  assert.equal(worker.shown[0].title, 'T')
  assert.equal(worker.shown[0].body, 'B')
  assert.equal(worker.shown[0].tag, 'twake-mail-new-mail')
})

test('a page that shows the new emails keeps the worker quiet', async () => {
  const page = makePage({ answers: ['reading', 'shown'] })
  const worker = loadWorker([page])

  await worker.dispatch('push', { data: stateChange })

  assert.deepEqual(page.messages, [
    { type: 'twake-mail-push', accountIds: ['a1'] }
  ])
  assert.equal(worker.shown.length, 0)
})

test('a page that reads for longer than the first wait is still waited for', async () => {
  // 4 s to say it reads, 20 s to show: here 40 ms and 200 ms
  const page = makePage({ answers: ['reading', 'shown'], delay: 30 })
  const worker = loadWorker([page])

  await worker.dispatch('push', { data: stateChange })

  assert.equal(worker.shown.length, 0)
})

test('a page that never ends its reading leaves the notification to the worker', async () => {
  const worker = loadWorker([makePage({ answers: ['reading'] })])

  await worker.dispatch('push', { data: stateChange })

  assert.equal(worker.shown.length, 1)
})

test('a page that fails to read leaves the notification to the worker', async () => {
  const worker = loadWorker([makePage({ answers: ['reading', 'failed'] })])

  await worker.dispatch('push', { data: stateChange })

  assert.equal(worker.shown.length, 1)
})

test('a page that does not answer leaves the notification to the worker', async () => {
  const worker = loadWorker([makePage()])

  await worker.dispatch('push', { data: stateChange })

  assert.equal(worker.shown.length, 1)
})

test('a frame of the origin is not asked', async () => {
  const frame = makePage({ answers: ['shown'], frameType: 'nested' })
  const worker = loadWorker([frame])

  await worker.dispatch('push', { data: stateChange })

  assert.deepEqual(frame.messages, [])
  assert.equal(worker.shown.length, 1)
})

test('a push that is not JSON is one of an unknown account', async () => {
  const page = makePage({ answers: ['shown'] })
  const worker = loadWorker([page])

  await worker.dispatch('push', {
    data: {
      json: () => {
        throw new SyntaxError('not JSON')
      }
    }
  })
  await worker.dispatch('push', { data: null })

  assert.deepEqual(page.messages, [
    { type: 'twake-mail-push', accountIds: null },
    { type: 'twake-mail-push', accountIds: null }
  ])
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

test('a click opens the email in one page of the app, the one in front first', async () => {
  const hidden = makePage({ answers: ['opened'] })
  const front = makePage({ answers: ['opened'], focused: true })
  const worker = loadWorker([hidden, front])
  let isClosed = false

  await worker.dispatch(
    'notificationclick',
    click({ url: '/mailbox/in/email/e1', accountId: 'a1' }, () => {
      isClosed = true
    })
  )

  assert.equal(isClosed, true)
  assert.deepEqual(front.messages, [
    { type: 'twake-mail-open', url: '/mailbox/in/email/e1', accountId: 'a1' }
  ])
  assert.equal(front.hasFocus, true)
  assert.deepEqual(hidden.messages, [])
  assert.deepEqual(worker.opened, [])
})

test('a click skips the pages that do not take the email', async () => {
  const other = makePage({ focused: true })
  const mine = makePage({ answers: ['opened'] })
  const worker = loadWorker([other, mine])

  await worker.dispatch(
    'notificationclick',
    click({ url: '/', accountId: 'a1' })
  )

  assert.equal(other.hasFocus, false)
  assert.equal(mine.hasFocus, true)
  assert.deepEqual(worker.opened, [])
})

test('a click opens the app when no page takes the email', async () => {
  const worker = loadWorker([makePage()])

  await worker.dispatch('notificationclick', click({ url: '/mailbox/x' }))
  await worker.dispatch('notificationclick', click(null))

  assert.deepEqual(worker.opened, ['/mailbox/x', '/'])
})
