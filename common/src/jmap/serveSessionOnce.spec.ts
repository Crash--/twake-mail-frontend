import { serveSessionOnce } from './serveSessionOnce'

const SESSION_URL = 'https://jmap.example.com/.well-known/jmap'
const API_URL = 'https://jmap.example.com/jmap'
const BODY = '{"username":"alice@example.com"}'
const NETWORK_BODY = '{"from":"network"}'

function makeNetwork(): jest.Mock<Promise<Response>, [string, RequestInit?]> {
  return jest.fn((_input: string, _init?: RequestInit) =>
    Promise.resolve(new Response(NETWORK_BODY, { status: 200 }))
  )
}

describe('serveSessionOnce', () => {
  it('answers the first read of the session with the body already read', async () => {
    const network = makeNetwork()
    const fetchFunction = serveSessionOnce(network, SESSION_URL, BODY)

    const response = await fetchFunction(SESSION_URL, { method: 'GET' })

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe(BODY)
    expect(network).not.toHaveBeenCalled()
  })

  it('fetches the session again on the next reads', async () => {
    const network = makeNetwork()
    const fetchFunction = serveSessionOnce(network, SESSION_URL, BODY)
    await fetchFunction(SESSION_URL)

    const response = await fetchFunction(SESSION_URL)

    await expect(response.text()).resolves.toBe(NETWORK_BODY)
    expect(network).toHaveBeenCalledTimes(1)
  })

  it('sends the other requests to the network', async () => {
    const network = makeNetwork()
    const fetchFunction = serveSessionOnce(network, SESSION_URL, BODY)

    await fetchFunction(API_URL, { method: 'POST', body: '{}' })
    await fetchFunction(SESSION_URL, { method: 'POST' })
    const sessionResponse = await fetchFunction(SESSION_URL)

    expect(network.mock.calls.map(([input]) => input)).toEqual([
      API_URL,
      SESSION_URL
    ])
    await expect(sessionResponse.text()).resolves.toBe(BODY)
  })
})
