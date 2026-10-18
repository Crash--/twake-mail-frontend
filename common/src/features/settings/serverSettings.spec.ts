import {
  isAlwaysRequestingReadReceipts,
  isShowingRemoteImages,
  isShowingSenderPriority
} from './serverSettings'

describe('server settings', () => {
  it('reads the booleans as tmail-flutter, with its defaults', () => {
    expect(isAlwaysRequestingReadReceipts({})).toBe(false)
    expect(
      isAlwaysRequestingReadReceipts({ 'read.receipts.always': 'true' })
    ).toBe(true)
    expect(isShowingSenderPriority({})).toBe(true)
    expect(
      isShowingSenderPriority({ 'display.sender.priority': 'false' })
    ).toBe(false)
    expect(isShowingSenderPriority({ 'display.sender.priority': 'yes' })).toBe(
      false
    )
  })

  it('asks before showing remote images unless the user turned it on', () => {
    expect(isShowingRemoteImages({})).toBe(false)
    expect(isShowingRemoteImages({ 'display.remote.images': 'true' })).toBe(
      true
    )
    expect(isShowingRemoteImages({ 'display.remote.images': 'false' })).toBe(
      false
    )
    expect(isShowingRemoteImages({ 'display.remote.images': '1' })).toBe(false)
  })
})
