import { LARGE_MESSAGE_SIZE, isLargeMessage } from './largeMessage'

const MB = 1024 * 1024

describe('isLargeMessage', () => {
  it('is large over 10 MB of attachments', () => {
    expect(
      isLargeMessage([
        { size: 6 * MB, status: 'done' },
        { size: 5 * MB, status: 'done' }
      ])
    ).toBe(true)
  })

  it('never warns below or at 10 MB', () => {
    expect(isLargeMessage([])).toBe(false)
    expect(isLargeMessage([{ size: 9 * MB, status: 'done' }])).toBe(false)
    expect(isLargeMessage([{ size: LARGE_MESSAGE_SIZE, status: 'done' }])).toBe(
      false
    )
  })

  it('leaves out the files whose upload failed', () => {
    expect(
      isLargeMessage([
        { size: 6 * MB, status: 'done' },
        { size: 5 * MB, status: 'failed' }
      ])
    ).toBe(false)
  })
})
