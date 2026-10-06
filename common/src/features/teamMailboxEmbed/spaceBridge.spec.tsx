import { replaceWith } from '@common/utils/navigation'

import {
  connectToSpace,
  isEmbedPath,
  LOGIN_REQUIRED_MESSAGE
} from './spaceBridge'

jest.mock('@common/utils/navigation', () => ({ replaceWith: jest.fn() }))

const SPACE_ORIGIN = 'https://space.example.com'
const BASENAME = '/embed/team-mailboxes/root1'
const TARGET = { basename: BASENAME, rootId: 'root1' }

function connect(): ReturnType<typeof connectToSpace> {
  return connectToSpace(SPACE_ORIGIN, TARGET)
}

function receive(data: unknown, origin = SPACE_ORIGIN): void {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin, source: window.parent })
  )
}

interface FakeBridge {
  isInIframe: jest.Mock
  setupBridge: jest.Mock
  notifyLoginRequired?: jest.Mock
}

let mockedBridge: FakeBridge | null = null

jest.mock('cozy-external-bridge', () => ({
  CozyBridge: jest.fn(() => mockedBridge)
}))

function mockBridge(overrides: Partial<FakeBridge> = {}): FakeBridge {
  mockedBridge = {
    isInIframe: jest.fn(() => true),
    setupBridge: jest.fn(() => true),
    ...overrides
  }
  return mockedBridge
}

describe('connectToSpace', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('talks to TwakeSpace only', () => {
    const bridge = mockBridge()

    expect(connect()).not.toBe(null)
    expect(bridge.setupBridge).toHaveBeenCalledWith(SPACE_ORIGIN)
  })

  it('is null without the origin of TwakeSpace, or outside a frame', () => {
    mockBridge({ isInIframe: jest.fn(() => false) })

    expect(connectToSpace(null, TARGET)).toBe(null)
    expect(connect()).toBe(null)
  })

  describe('syncHistory', () => {
    // eslint-disable-next-line jest/unbound-method
    const { pushState: originalPush, replaceState: originalReplace } =
      window.history
    let stop: (() => void) | undefined
    let postMessage: jest.SpyInstance

    beforeEach(() => {
      originalReplace.call(window.history, null, '', `${BASENAME}/inbox`)
      postMessage = jest
        .spyOn(window.parent, 'postMessage')
        .mockImplementation(() => undefined)
    })

    afterEach(() => {
      stop?.()
      stop = undefined
    })

    function sync(
      applyNavigation: (path: string) => void | Promise<void> = jest.fn()
    ): void {
      stop = connect()?.syncHistory(applyNavigation)
    }

    it('patches the history only once started, and restores it', () => {
      mockBridge({ isInIframe: jest.fn(() => false) })
      expect(connect()).toBe(null)
      expect(window.history.pushState).toBe(originalPush)

      mockBridge()
      sync()
      expect(window.history.pushState).not.toBe(originalPush)
      stop?.()
      expect(window.history.pushState).toBe(originalPush)
      expect(window.history.replaceState).toBe(originalReplace)
    })

    it('reports the initial path as a replace', () => {
      mockBridge()
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
      mockBridge()
      sync()

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ path: '' }),
        SPACE_ORIGIN
      )
    })

    it('turns pushState into a replace that adds no entry', () => {
      mockBridge()
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
      mockBridge()
      sync()
      postMessage.mockClear()

      window.history.replaceState(null, '', `${BASENAME}/sent`)

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/sent', replace: true }),
        SPACE_ORIGIN
      )
    })

    it('applies a navigate for this mailbox without reporting it', async () => {
      mockBridge()
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
      mockBridge()
      const applyNavigation = jest.fn()
      sync(applyNavigation)

      receive({ type: 'twake-embed:navigate', resourceId: 'root2', path: '/a' })

      expect(applyNavigation).not.toHaveBeenCalled()
    })

    it('ignores messages from another origin', () => {
      mockBridge()
      const applyNavigation = jest.fn()
      sync(applyNavigation)

      receive(
        { type: 'twake-embed:navigate', resourceId: 'root1', path: '/a' },
        'https://evil.example.com'
      )
      receive(
        { type: 'twake-embed:load', resourceId: 'root2', path: '/a' },
        'https://evil.example.com'
      )

      expect(applyNavigation).not.toHaveBeenCalled()
      expect(replaceWith).not.toHaveBeenCalled()
    })

    it('replaces the frame for a load', () => {
      mockBridge()
      sync()

      receive({ type: 'twake-embed:load', resourceId: 'root2', path: '/inbox' })

      expect(replaceWith).toHaveBeenCalledWith(
        '/embed/team-mailboxes/root2/inbox'
      )
    })

    it('drops a load with a bad resource id or path', () => {
      mockBridge()
      sync()

      receive({ type: 'twake-embed:load', resourceId: 'a/b', path: '' })
      receive({ type: 'twake-embed:load', resourceId: 'root2', path: '//x' })

      expect(replaceWith).not.toHaveBeenCalled()
    })
  })

  describe('isEmbedPath', () => {
    it.each(['', '/', '/inbox?x=1', '?q=a', '#top'])('accepts %j', path => {
      expect(isEmbedPath(path)).toBe(true)
    })

    it.each(['inbox', '//evil.com', '/../x', '/a\\b', 1, null])(
      'rejects %j',
      path => {
        expect(isEmbedPath(path)).toBe(false)
      }
    )
  })

  it('asks TwakeSpace to sign in through the bridge', () => {
    const bridge = mockBridge({
      notifyLoginRequired: jest.fn(() => Promise.resolve())
    })
    const postMessage = jest.spyOn(window.parent, 'postMessage')

    connect()?.notifyLoginRequired()

    expect(bridge.notifyLoginRequired).toHaveBeenCalledTimes(1)
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('posts the message to TwakeSpace with a bridge that cannot say it', () => {
    mockBridge()
    const postMessage = jest
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => undefined)

    connect()?.notifyLoginRequired()

    expect(postMessage).toHaveBeenCalledWith(
      LOGIN_REQUIRED_MESSAGE,
      SPACE_ORIGIN
    )
  })

  it('tells TwakeSpace the region of the overlay, to its origin only', () => {
    mockBridge()
    const postMessage = jest.spyOn(window.parent, 'postMessage')

    connect()?.reportOverlayRegion([{ x: 1, y: 2, width: 3, height: 4 }])

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'twake-embed:overlay-region',
        region: [{ x: 1, y: 2, width: 3, height: 4 }]
      },
      SPACE_ORIGIN
    )
  })
})
