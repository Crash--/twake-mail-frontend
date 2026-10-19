import {
  elapsedMs,
  randomTexts,
  STRESS_TIME_LIMIT_MS
} from '@common/testing/redos'

import { scrubDeep, scrubText, scrubUrl } from './scrubSensitiveData'

describe('scrubText', () => {
  it('masks the OIDC callback parameters', () => {
    expect(scrubText('GET /callback?code=abc&state=xyz&iss=https://sso')).toBe(
      'GET /callback?code=[Filtered]&state=[Filtered]&iss=https://sso'
    )
  })

  it('masks bearer and basic credentials', () => {
    expect(scrubText('Authorization: Bearer eyJhbGciOi.payload.sig')).toBe(
      'Authorization: Bearer [Filtered]'
    )
    expect(scrubText('Basic YWxpY2U6c2VjcmV0')).toBe('Basic [Filtered]')
  })

  it('masks email addresses', () => {
    expect(scrubText('No mailbox for alice@example.com')).toBe(
      'No mailbox for [email]'
    )
  })
})

describe('scrubUrl', () => {
  it('drops the query string and the fragment', () => {
    expect(scrubUrl('https://mail.example.com/callback?code=abc#x')).toBe(
      'https://mail.example.com/callback'
    )
  })
})

describe('scrubDeep', () => {
  it('scrubs nested strings and drops credential keys', () => {
    const event = {
      request: {
        url: 'https://mail.example.com/callback?code=abc',
        headers: { Authorization: 'Bearer token', Accept: 'text/html' }
      },
      breadcrumbs: [{ message: 'login as bob@example.com' }]
    }

    expect(scrubDeep(event)).toEqual({
      request: {
        url: 'https://mail.example.com/callback',
        headers: { Accept: 'text/html' }
      },
      breadcrumbs: [{ message: 'login as [email]' }]
    })
  })
})

describe('scrubText, more', () => {
  it('drops the query string of the URLs of a message', () => {
    expect(
      scrubText(
        'HTTP 500 on https://jmap.example.com/jmap?account=bob&x=1#frag'
      )
    ).toBe('HTTP 500 on https://jmap.example.com/jmap')
  })

  it('masks a JWT and the PKCE verifier', () => {
    expect(
      scrubText(
        'token eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJib2IifQ.c2ln code_verifier=abcDEF'
      )
    ).toBe('token [Filtered] code_verifier=[Filtered]')
  })
})

describe('scrubUrl, more', () => {
  it.each([
    [
      'https://mail.example.com/mailbox/abc123/email/xyz789',
      'https://mail.example.com/mailbox/:id/email/:id'
    ],
    ['/label/L1', '/label/:id'],
    [
      'https://jmap.example.com/download/acc/blob/payslip.pdf',
      'https://jmap.example.com/download/[Filtered]'
    ],
    [
      'https://jmap.example.com/upload/acc/',
      'https://jmap.example.com/upload/[Filtered]'
    ],
    ['/search?q=bob%40example.com', '/search'],
    ['/settings/preferences', '/settings/preferences']
  ])('%s becomes %s', (url, expected) => {
    expect(scrubUrl(url)).toBe(expected)
  })
})

describe('scrubDeep, the content of the mails', () => {
  it('replaces the subject, preview, bodies, recipients and search of a JMAP object', () => {
    const message = {
      id: 'e1',
      subject: 'Salary review',
      preview: 'Hi Bob',
      from: [{ name: 'Alice', email: 'alice@example.com' }],
      to: [{ email: 'bob@example.com' }],
      bodyValues: { 1: { value: 'secret' } },
      keywords: { $seen: true },
      filter: { text: 'invoice', q: 'salary' }
    }

    expect(scrubDeep({ message })).toEqual({
      message: {
        id: 'e1',
        subject: '[Filtered]',
        preview: '[Filtered]',
        from: '[Filtered]',
        to: '[Filtered]',
        bodyValues: '[Filtered]',
        keywords: { $seen: true },
        filter: { text: '[Filtered]', q: '[Filtered]' }
      }
    })
  })

  it('hides the name and the identifiers of an attachment', () => {
    expect(
      scrubDeep({
        part: {
          blobId: 'G1',
          name: 'payslip.pdf',
          type: 'application/pdf',
          size: 3
        }
      })
    ).toEqual({
      part: {
        blobId: '[Filtered]',
        name: '[Filtered]',
        type: 'application/pdf',
        size: 3
      }
    })
  })

  it('hides tokens kept under their usual names', () => {
    expect(
      scrubDeep({
        accessToken: 'a',
        refresh_token: 'b',
        code: 'c',
        state: 'd',
        cookie: 'e'
      })
    ).toEqual({
      accessToken: '[Filtered]',
      refresh_token: '[Filtered]',
      code: '[Filtered]',
      state: '[Filtered]'
    })
  })

  it('keeps the URLs of navigation breadcrumbs, scrubbed', () => {
    expect(scrubDeep({ from: '/mailbox/m1?q=a', to: '/search?q=b' })).toEqual({
      from: '/mailbox/:id',
      to: '/search'
    })
  })
})

describe('scrubSensitiveData against ReDoS', () => {
  // The patterns scrubText and scrubUrl used to run, quadratic on a failing
  // text (the two others did not change)
  const ORIGINAL_EMAIL = /[A-Z0-9._%+-]+(?:@|%40)[A-Z0-9.-]+\.[A-Z]{2,}/gi
  const ORIGINAL_URL_WITH_QUERY = /(\bhttps?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi
  const ORIGINAL_JWT =
    /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g
  const UNCHANGED = scrubText('code=a ticket=b Bearer c')

  function originalScrub(text: string): string {
    return text
      .replace(ORIGINAL_URL_WITH_QUERY, '$1')
      .replace(ORIGINAL_JWT, '[Filtered]')
      .replace(ORIGINAL_EMAIL, '[email]')
  }

  it('masks what the original patterns masked', () => {
    // Without the parameters and credentials the patterns that did not
    // change mask, so that the order of the replacements does not matter
    expect(UNCHANGED).toBe(
      'code=[Filtered] ticket=[Filtered] Bearer [Filtered]'
    )
    const texts = randomTexts(
      [
        'a',
        'B',
        '1',
        '.',
        '-',
        '_',
        '%',
        '%40',
        '@',
        '+',
        ' ',
        '?',
        '#',
        '"',
        '/',
        'http://',
        'HTTPS://',
        'eyJ',
        'abcde',
        'x.io'
      ],
      { count: 5000, maxLength: 16 }
    )
    for (const text of texts) {
      expect([text, scrubText(text)]).toEqual([text, originalScrub(text)])
    }
  })

  it('masks what follows /download/ on the last line only, as before', () => {
    const original = (path: string): string =>
      path.replace(/\/(download|upload)\/.*$/i, '/$1/[Filtered]')
    for (const path of randomTexts([
      '/download/',
      '/UPLOAD/',
      'a',
      '/',
      '\n',
      '\r',
      ' '
    ])) {
      expect([path, scrubUrl(path)]).toEqual([path, scrubText(original(path))])
    }
  })

  it.each([
    ['an address without domain', 'A'.repeat(50_000) + 'AA.AA\x00.@-.AA'],
    ['addresses without top-level domain', 'a@' + 'a.'.repeat(25_000)],
    ['URLs without query', 'http://\x00'.repeat(7000)],
    ['tokens without parts', 'eyJyyyy-'.repeat(7000)]
  ])('scrubs %s in a linear time', (_, text) => {
    expect(elapsedMs(() => scrubText(text))).toBeLessThan(STRESS_TIME_LIMIT_MS)
  })

  it('scrubs a path with many lines in a linear time', () => {
    const path = '/upload/'.repeat(7000) + '\n/upload/'
    expect(elapsedMs(() => scrubUrl(path))).toBeLessThan(STRESS_TIME_LIMIT_MS)
  })
})
