import {
  isAlwaysRequestingReadReceipts,
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
})
