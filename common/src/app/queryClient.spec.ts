import { shouldRetryQuery } from './queryClient'

describe('shouldRetryQuery', () => {
  it('does not retry client errors', () => {
    expect(shouldRetryQuery(0, { status: 401 })).toBe(false)
    expect(shouldRetryQuery(0, { status: 404 })).toBe(false)
  })

  it('retries other failures twice', () => {
    const serverError = { status: 503 }
    expect(shouldRetryQuery(0, serverError)).toBe(true)
    expect(shouldRetryQuery(1, new TypeError('Failed to fetch'))).toBe(true)
    expect(shouldRetryQuery(2, serverError)).toBe(false)
  })
})
