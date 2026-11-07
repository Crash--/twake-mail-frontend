import { toLinkUrl } from './linkUrl'

describe('toLinkUrl', () => {
  it.each([
    'https://example.org/page',
    'http://example.org',
    'mailto:bob@example.org',
    'tel:+33123456789'
  ])('keeps the absolute address %s', url => {
    expect(toLinkUrl(url)).toBe(url)
  })

  it('trims the address', () => {
    expect(toLinkUrl('  https://example.org  ')).toBe('https://example.org')
  })

  it.each([
    ['example.org/x', 'https://example.org/x'],
    ['www.example.org', 'https://www.example.org'],
    ['example.org:8080/a?b=c#d', 'https://example.org:8080/a?b=c#d']
  ])('completes the bare host %s with https://', (url, expected) => {
    expect(toLinkUrl(url)).toBe(expected)
  })

  it.each([
    'not a url',
    'page#top',
    '/relative/path',
    '//example.org',
    'javascript:alert(1)',
    'ftp://example.org',
    'https://',
    'https://exa mple.org'
  ])('refuses %s', url => {
    expect(toLinkUrl(url)).toBe(null)
  })

  it.each(['e.0', ' ww.0', 'm2i1.2.3.4', 'example.123'])(
    'refuses the bare host %j, which no browser parses as a URL',
    url => {
      expect(toLinkUrl(url)).toBe(null)
    }
  )

  it('completes a bare IPv4 address with https://', () => {
    expect(toLinkUrl('192.168.0.1/x')).toBe('https://192.168.0.1/x')
  })
})
