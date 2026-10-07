import { CozyStackError, makeIntentsFetch } from './intentsFetch'

function respond(status: number, json: unknown): jest.Mock {
  return jest.fn().mockResolvedValue(
    new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/vnd.api+json' }
    })
  )
}

describe('makeIntentsFetch', () => {
  it('calls the stack with its token and gives the JSON back', async () => {
    const fetchFunction = respond(200, { data: { id: 'abc' } })
    const intentsFetch = makeIntentsFetch(
      'https://alice.example.com',
      'stack-token',
      fetchFunction
    )

    await expect(intentsFetch('GET', '/intents/abc')).resolves.toEqual({
      data: { id: 'abc' }
    })
    expect(fetchFunction).toHaveBeenCalledWith(
      'https://alice.example.com/intents/abc',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer stack-token'
        }),
        credentials: 'omit'
      })
    )
  })

  it('rejects with the status the stack answers', async () => {
    const intentsFetch = makeIntentsFetch(
      'https://alice.example.com',
      'stack-token',
      respond(403, { errors: [] })
    )

    await expect(intentsFetch('GET', '/intents/abc')).rejects.toEqual(
      new CozyStackError(403)
    )
    await expect(
      intentsFetch('GET', '/intents/abc').catch((error: unknown) =>
        error instanceof CozyStackError ? error.status : null
      )
    ).resolves.toBe(403)
  })

  it('rejects without status when the stack cannot be reached', async () => {
    const intentsFetch = makeIntentsFetch(
      'https://alice.example.com',
      'stack-token',
      jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    )

    await expect(
      intentsFetch('GET', '/intents/abc').catch((error: unknown) =>
        error instanceof CozyStackError ? error.status : 'other'
      )
    ).resolves.toBe(null)
  })
})
