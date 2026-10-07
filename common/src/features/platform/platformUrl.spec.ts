import { resolvePlatformUrl } from './platformUrl'

const USER = {
  username: 'alice@example.com',
  workplaceFqdn: null,
  workplaceFqdnFallback: null
}

describe('resolvePlatformUrl', () => {
  it('reads the workplace of the SSO', () => {
    expect(
      resolvePlatformUrl({ ...USER, workplaceFqdn: 'alice.twake.example.com' })
    ).toBe('https://alice.twake.example.com')
  })

  it('keeps an explicit https scheme and drops a trailing slash', () => {
    expect(
      resolvePlatformUrl({
        ...USER,
        workplaceFqdn: 'https://alice.twake.example.com/'
      })
    ).toBe('https://alice.twake.example.com')
  })

  it('falls back to WORKPLACE_FQDN_FALLBACK with the local part', () => {
    expect(
      resolvePlatformUrl({
        ...USER,
        workplaceFqdnFallback: '{localpart}.twake.example.com'
      })
    ).toBe('https://alice.twake.example.com')
  })

  it('prefers the SSO to the fallback', () => {
    expect(
      resolvePlatformUrl({
        ...USER,
        workplaceFqdn: 'acme.twake.example.com',
        workplaceFqdnFallback: '{localpart}.twake.example.com'
      })
    ).toBe('https://acme.twake.example.com')
  })

  it('has no platform without a workplace', () => {
    expect(resolvePlatformUrl(USER)).toBe(null)
  })

  it('refuses what is not a bare https host', () => {
    for (const workplaceFqdn of [
      'http://alice.twake.example.com',
      'alice.twake.example.com/path',
      'localhost'
    ]) {
      expect(resolvePlatformUrl({ ...USER, workplaceFqdn })).toBe(null)
    }
  })
})
