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
