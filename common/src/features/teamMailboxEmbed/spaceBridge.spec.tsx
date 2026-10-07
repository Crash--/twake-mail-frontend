import { replaceWith } from '@common/utils/navigation'

import { connectToSpace, reportOverlayRegion } from './spaceBridge'

jest.mock('@common/utils/navigation', () => ({ replaceWith: jest.fn() }))

const SPACE_ORIGIN = 'https://space.example.com'
const BASENAME = '/embed/team-mailboxes/root1'
const TARGET = { basename: BASENAME, rootId: 'root1' }

function connect(): ReturnType<typeof connectToSpace> {
  return connectToSpace(TARGET)
}

describe('connectToSpace', () => {
  const realParent = window.parent
  let postMessage: jest.SpyInstance
  let fakeParent: Window

  function receive(data: unknown, origin = SPACE_ORIGIN): void {
    window.dispatchEvent(
      new MessageEvent('message', { data, origin, source: fakeParent })
    )
  }

  function greet(origin = SPACE_ORIGIN): void {
    receive({ type: 'twake-embed:hello' }, origin)
  }

  function postedTypes(): unknown[] {
    return postMessage.mock.calls.map(
      ([message]: [{ type?: unknown }]) => message.type
    )
  }

  function frame(parent: Window): void {
    Object.defineProperty(window, 'parent', {
      value: parent,
      configurable: true
    })
  }

  beforeEach(() => {
    // Any other window stands for TwakeSpace's page
    const host = document.createElement('iframe')
    document.body.appendChild(host)
    fakeParent = host.contentWindow ?? window
    postMessage = jest
      .spyOn(fakeParent, 'postMessage')
      .mockImplementation(() => undefined)
    frame(fakeParent)
  })

  afterEach(() => {
    frame(realParent)
    document.querySelectorAll('iframe').forEach(host => {
      host.remove()
    })
    jest.clearAllMocks()
  })

  it('is null outside a frame', () => {
    frame(window)
    expect(connect()).toBe(null)
  })

  it('is a connection in a frame', () => {
    expect(connect()).not.toBe(null)
  })

  describe('syncHistory', () => {
    // eslint-disable-next-line jest/unbound-method
    const { pushState: originalPush, replaceState: originalReplace } =
      window.history
    let stop: (() => void) | undefined

    beforeEach(() => {
      originalReplace.call(window.history, null, '', `${BASENAME}/inbox`)
    })

    afterEach(() => {
      stop?.()
      stop = undefined
    })

    function sync(
      applyNavigation: (path: string) => void | Promise<void> = jest.fn()
    ): void {
      const connection = connect()
      greet()
      stop = connection?.syncHistory(applyNavigation)
    }

    it('posts only its readiness until TwakeSpace greets the frame', () => {
      const connection = connect()
      stop = connection?.syncHistory(jest.fn())
      window.history.replaceState(null, '', `${BASENAME}/sent`)
      connection?.notifyLoginRequired()

      expect(postedTypes()).toEqual(
        expect.arrayContaining(['twake-embed:ready'])
      )
      expect(postedTypes()).not.toContain('twake-embed:path')
      expect(postedTypes()).not.toContain('twake-embed:login-required')

      greet()

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'twake-embed:path', path: '/sent' }),
        SPACE_ORIGIN
      )
    })

    it('says it is ready to any origin, as it does not know TwakeSpace yet', () => {
      const connection = connect()
      expect(postMessage).toHaveBeenCalledWith(
        { type: 'twake-embed:ready' },
        '*'
      )

      postMessage.mockClear()
      stop = connection?.syncHistory(jest.fn())

      expect(postMessage).toHaveBeenCalledWith(
        { type: 'twake-embed:ready' },
        '*'
      )
    })

    it('answers the origin of the parent that greeted', () => {
      sync()
      postMessage.mockClear()

      greet('https://other-space.example.com')
      window.history.replaceState(null, '', `${BASENAME}/sent`)

      expect(postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ path: '/sent' }),
        'https://other-space.example.com'
      )
    })

    it('patches the history only once started, and restores it', () => {
      connect()
      expect(window.history.pushState).toBe(originalPush)

      sync()
      expect(window.history.pushState).not.toBe(originalPush)
      stop?.()
      expect(window.history.pushState).toBe(originalPush)
      expect(window.history.replaceState).toBe(originalReplace)
    })

    it('reports the initial path as a replace', () => {
      sync()

      expect(postMessage).toHaveBeenCalledWith(
        {
          type: 'twake-embed:path',
          resourceId: 'root1',
          path: '/inbox',
          replace: true
        },
        SPACE_ORIGIN
      )
    })

    it('reports the embed route itself as an empty path', () => {
      originalReplace.call(window.history, null, '', BASENAME)
      sync()

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ path: '' }),
        SPACE_ORIGIN
      )
    })

    it('turns pushState into a replace that adds no entry', () => {
      sync()
      postMessage.mockClear()
      const length = window.history.length

      window.history.pushState(null, '', `${BASENAME}/inbox/m1?x=1#top`)

      expect(window.history.length).toBe(length)
      expect(window.location.pathname).toBe(`${BASENAME}/inbox/m1`)
      expect(postMessage).toHaveBeenCalledTimes(1)
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: 'twake-embed:path',
          resourceId: 'root1',
          path: '/inbox/m1?x=1#top',
          replace: false
        },
        SPACE_ORIGIN
      )
    })

    it('reports replaceState as a replace', () => {
      sync()
      postMessage.mockClear()

      window.history.replaceState(null, '', `${BASENAME}/sent`)

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/sent', replace: true }),
        SPACE_ORIGIN
      )
    })

    it('applies a navigate for this mailbox without reporting it', async () => {
      const applyNavigation = jest.fn((path: string) => {
        window.history.replaceState(null, '', `${BASENAME}${path}`)
      })
      sync(applyNavigation)
      postMessage.mockClear()

      receive({
        type: 'twake-embed:navigate',
        resourceId: 'root1',
        path: '?q=a'
      })
      await Promise.resolve()

      expect(applyNavigation).toHaveBeenCalledWith('/?q=a')
      expect(postMessage).not.toHaveBeenCalled()

      window.history.replaceState(null, '', `${BASENAME}/sent`)
      expect(postMessage).toHaveBeenCalledTimes(1)
    })

    it('drops a navigate for another mailbox', () => {
      const applyNavigation = jest.fn()
      sync(applyNavigation)

      receive({ type: 'twake-embed:navigate', resourceId: 'root2', path: '/a' })

      expect(applyNavigation).not.toHaveBeenCalled()
    })

    it('ignores messages that do not come from the parent', () => {
      const applyNavigation = jest.fn()
      sync(applyNavigation)

      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'twake-embed:navigate',
            resourceId: 'root1',
            path: '/a'
          },
          origin: SPACE_ORIGIN,
          source: window
        })
      )
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'twake-embed:load', resourceId: 'root2', path: '/a' },
          origin: 'https://evil.example.com',
          source: null
        })
      )

      expect(applyNavigation).not.toHaveBeenCalled()
      expect(replaceWith).not.toHaveBeenCalled()
    })

    it('replaces the frame for a load', () => {
      sync()

      receive({ type: 'twake-embed:load', resourceId: 'root2', path: '/inbox' })

      expect(replaceWith).toHaveBeenCalledWith(
        '/embed/team-mailboxes/root2/inbox'
      )
    })

    it('drops a load with a bad resource id or a path leaving the route', () => {
      sync()

      receive({ type: 'twake-embed:load', resourceId: 'a/b', path: '' })
      receive({ type: 'twake-embed:load', resourceId: 'root2', path: '/../x' })
      receive({ type: 'twake-embed:load', resourceId: 'root2', path: '//x' })
      receive({ type: 'twake-embed:load', resourceId: 'root2', path: '/a\\b' })

      expect(replaceWith).not.toHaveBeenCalled()
    })
  })

  it('asks TwakeSpace to sign in, to the origin that greeted only', () => {
    const connection = connect()
    greet()
    connection?.notifyLoginRequired()

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'twake-embed:login-required' },
      SPACE_ORIGIN
    )
  })
})

describe('reportOverlayRegion', () => {
  it('tells the page framing the facade, without the origin of TwakeSpace', () => {
    const postMessage = jest
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => undefined)

    reportOverlayRegion([{ x: 1, y: 2, width: 3, height: 4 }])

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'twake-embed:overlay-region',
        region: [{ x: 1, y: 2, width: 3, height: 4 }]
      },
      '*'
    )
  })
})
