import { storageQuota } from './quota'

const QUOTA = {
  id: 'q',
  scope: 'account',
  name: 'alice',
  types: ['Mail'],
  used: 50,
  hardLimit: 100
}

describe('storageQuota', () => {
  it('reads the first quota in octets', () => {
    expect(
      storageQuota([
        { ...QUOTA, id: 'count', resourceType: 'count', used: 99 },
        { ...QUOTA, resourceType: 'octets', warnLimit: 90 }
      ])
    ).toEqual({ used: 50, limit: 100, isWarning: false, isFull: false })
  })

  it('warns from the warning limit of the server, and when full', () => {
    expect(
      storageQuota([
        { ...QUOTA, resourceType: 'octets', used: 91, warnLimit: 90 }
      ])
    ).toMatchObject({ isWarning: true, isFull: false })
    expect(
      storageQuota([{ ...QUOTA, resourceType: 'octets', used: 100 }])
    ).toMatchObject({ isWarning: true, isFull: true })
  })

  it('has none without a limit', () => {
    expect(
      storageQuota([{ ...QUOTA, resourceType: 'octets', hardLimit: 0 }])
    ).toBe(null)
    expect(storageQuota([])).toBe(null)
  })
})
