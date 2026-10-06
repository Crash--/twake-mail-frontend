import { connectToSpace, LOGIN_REQUIRED_MESSAGE } from './spaceBridge'

const SPACE_ORIGIN = 'https://space.example.com'

interface FakeBridge {
  isInIframe: jest.Mock
  setupBridge: jest.Mock
  startHistorySyncing: jest.Mock
  stopHistorySyncing: jest.Mock
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
    startHistorySyncing: jest.fn(),
    stopHistorySyncing: jest.fn(),
    ...overrides
  }
  return mockedBridge
}

describe('connectToSpace', () => {
  it('talks to TwakeSpace only', () => {
    const bridge = mockBridge()

    expect(connectToSpace(SPACE_ORIGIN)).not.toBe(null)
    expect(bridge.setupBridge).toHaveBeenCalledWith(SPACE_ORIGIN)
  })

  it('is null without the origin of TwakeSpace, or outside a frame', () => {
    mockBridge({ isInIframe: jest.fn(() => false) })

    expect(connectToSpace(null)).toBe(null)
    expect(connectToSpace(SPACE_ORIGIN)).toBe(null)
  })

  it('sends the navigation to TwakeSpace until stopped', () => {
    const bridge = mockBridge()
    const stop = connectToSpace(SPACE_ORIGIN)?.syncHistory()

    expect(bridge.startHistorySyncing).toHaveBeenCalledTimes(1)
    stop?.()
    expect(bridge.stopHistorySyncing).toHaveBeenCalledTimes(1)
  })

  it('asks TwakeSpace to sign in through the bridge', () => {
    const bridge = mockBridge({
      notifyLoginRequired: jest.fn(() => Promise.resolve())
    })
    const postMessage = jest.spyOn(window.parent, 'postMessage')

    connectToSpace(SPACE_ORIGIN)?.notifyLoginRequired()

    expect(bridge.notifyLoginRequired).toHaveBeenCalledTimes(1)
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('posts the message to TwakeSpace with a bridge that cannot say it', () => {
    mockBridge()
    const postMessage = jest
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => undefined)

    connectToSpace(SPACE_ORIGIN)?.notifyLoginRequired()

    expect(postMessage).toHaveBeenCalledWith(
      LOGIN_REQUIRED_MESSAGE,
      SPACE_ORIGIN
    )
  })
})
