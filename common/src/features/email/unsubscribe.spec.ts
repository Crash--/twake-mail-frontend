import { isUnsubscribed, pickUnsubscribeMethod } from './unsubscribe'

describe('pickUnsubscribeMethod', () => {
  it('prefers a web link to a mailto one, as tmail-flutter', () => {
    expect(
      pickUnsubscribeMethod([
        'mailto:leave@example.com',
        'https://example.com/u?id=1'
      ])
    ).toEqual({ kind: 'web', url: 'https://example.com/u?id=1' })
  })

  it('accepts http links', () => {
    expect(pickUnsubscribeMethod(['http://example.com/u'])).toEqual({
      kind: 'web',
      url: 'http://example.com/u'
    })
  })

  it('reads a mailto link with its subject and body', () => {
    expect(
      pickUnsubscribeMethod([
        'mailto:leave@example.com?subject=Unsubscribe%20me&body=please'
      ])
    ).toEqual({
      kind: 'mailto',
      mailto: {
        to: ['leave@example.com'],
        cc: [],
        bcc: [],
        subject: 'Unsubscribe me',
        body: 'please'
      }
    })
  })

  it.each([
    ['no header', null],
    ['an empty header', []],
    ['a script link', ['javascript:alert(1)']],
    ['a data link', ['data:text/html,<b>x</b>']],
    ['a file link', ['file:///etc/passwd']],
    ['a mailto link without address', ['mailto:']],
    ['text that is no URL', ['not a url']]
  ])('offers nothing for %s', (_name, links) => {
    expect(pickUnsubscribeMethod(links)).toBe(null)
  })

  it('skips the links it cannot use for the next one', () => {
    expect(
      pickUnsubscribeMethod(['javascript:void(0)', 'mailto:a@b.c'])
    ).toEqual(expect.objectContaining({ kind: 'mailto' }))
  })
})

describe('isUnsubscribed', () => {
  it('reads the $unsubscribe keyword', () => {
    expect(isUnsubscribed({ keywords: { $unsubscribe: true } })).toBe(true)
    expect(isUnsubscribed({ keywords: { $seen: true } })).toBe(false)
  })
})
