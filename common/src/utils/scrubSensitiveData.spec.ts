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
