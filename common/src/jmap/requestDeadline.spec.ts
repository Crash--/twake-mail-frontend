import type { FetchFunction } from 'jmap-client-ts'

import { withDeadline, withRequestDeadline } from './requestDeadline'

const API_URL = 'https://jmap.example.com/jmap'

/** Never answers; fails when the signal aborts, as `fetch` does */
function makeHangingFetch(): jest.Mock<
  ReturnType<FetchFunction>,
  Parameters<FetchFunction>
> {
  return jest.fn(
    (_input: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const reason: unknown = init.signal?.reason
          reject(
            reason instanceof Error || reason instanceof DOMException
              ? reason
              : new Error(String(reason))
          )
        })
      })
  )
}

const JSON_POST: RequestInit = {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  body: '{"using":[],"methodCalls":[]}'
}

describe('withDeadline', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('aborts with a TimeoutError once the deadline is reached', () => {
    const signal = withDeadline(null, 1000)

    jest.advanceTimersByTime(999)
    expect(signal.aborted).toBe(false)
    jest.advanceTimersByTime(1)

    expect(signal.aborted).toBe(true)
    expect(signal.reason).toBeInstanceOf(DOMException)
    expect((signal.reason as DOMException).name).toBe('TimeoutError')
  })

  it('aborts with the reason of the caller signal', () => {
    const caller = new AbortController()
    const signal = withDeadline(caller.signal, 1000)

    caller.abort('unmounted')

    expect(signal.aborted).toBe(true)
    expect(signal.reason).toBe('unmounted')
  })

  it('is aborted at once when the caller signal already is', () => {
    const signal = withDeadline(AbortSignal.abort('gone'), 1000)

    expect(signal.aborted).toBe(true)
    expect(signal.reason).toBe('gone')
  })
})

describe('withRequestDeadline', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('fails an API call that never answers', async () => {
    const fetchWithDeadline = withRequestDeadline(makeHangingFetch(), 1000)

    const response = fetchWithDeadline(API_URL, JSON_POST)
    jest.advanceTimersByTime(1000)

    await expect(response).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('still lets the caller cancel the call', async () => {
    const fetchWithDeadline = withRequestDeadline(makeHangingFetch(), 1000)
    const caller = new AbortController()

    const response = fetchWithDeadline(API_URL, {
      ...JSON_POST,
      signal: caller.signal
    })
    caller.abort(new DOMException('Cancelled', 'AbortError'))

    await expect(response).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('bounds the session fetch, which has no body', () => {
    const fetch = makeHangingFetch()

    withRequestDeadline(fetch, 1000)(API_URL, {
      headers: { Accept: 'application/json' }
    }).catch(() => undefined)

    expect(fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('leaves uploads and downloads without a deadline', () => {
    const fetch = makeHangingFetch()
    const fetchWithDeadline = withRequestDeadline(fetch, 1000)

    fetchWithDeadline(`${API_URL}/upload`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new Blob(['data'])
    }).catch(() => undefined)
    fetchWithDeadline(`${API_URL}/download`, {
      headers: { Authorization: 'Bearer token' }
    }).catch(() => undefined)

    expect(fetch.mock.calls.map(([, init]) => init?.signal)).toEqual([
      undefined,
      undefined
    ])
  })
})
