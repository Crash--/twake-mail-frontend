import { makeJmapDevProxy, rewriteSession } from './jmapDevProxy'

const SESSION = {
  username: 'alice@example.com',
  apiUrl: 'http://127.0.0.1:18302/jmap',
  downloadUrl:
    'http://127.0.0.1:18302/download/{accountId}/{blobId}?type={type}&name={name}',
  uploadUrl: 'http://127.0.0.1:18302/upload/{accountId}',
  eventSourceUrl:
    'http://127.0.0.1:18302/eventSource?types={types}&closeafter={closeafter}&ping={ping}',
  capabilities: {
    'urn:ietf:params:jmap:websocket': {
      supportsPush: true,
      url: 'ws://127.0.0.1:18302/jmap/ws'
    },
    'com:linagora:params:jmap:ws:ticket': {
      generationEndpoint: 'http://127.0.0.1:18302/jmap/ws/ticket'
    },
    'urn:apache:james:params:jmap:mail:identity:sortorder': {}
  },
  accounts: { a1: { name: 'https://unrelated.example.com/keep' } }
}

describe('rewriteSession', () => {
  it('moves every advertised endpoint to the development server', () => {
    const rewritten: unknown = JSON.parse(
      rewriteSession(JSON.stringify(SESSION), 'http://127.0.0.1:18200')
    )

    expect(rewritten).toEqual({
      ...SESSION,
      apiUrl: 'http://127.0.0.1:18200/jmap',
      downloadUrl:
        'http://127.0.0.1:18200/download/{accountId}/{blobId}?type={type}&name={name}',
      uploadUrl: 'http://127.0.0.1:18200/upload/{accountId}',
      eventSourceUrl:
        'http://127.0.0.1:18200/eventSource?types={types}&closeafter={closeafter}&ping={ping}',
      capabilities: {
        ...SESSION.capabilities,
        'urn:ietf:params:jmap:websocket': {
          supportsPush: true,
          url: 'ws://127.0.0.1:18200/jmap/ws'
        },
        'com:linagora:params:jmap:ws:ticket': {
          generationEndpoint: 'http://127.0.0.1:18200/jmap/ws/ticket'
        }
      }
    })
  })
})

describe('makeJmapDevProxy', () => {
  it('proxies nothing without a target', () => {
    expect(makeJmapDevProxy(undefined)).toBe(undefined)
    expect(makeJmapDevProxy('')).toBe(undefined)
  })

  it('proxies the JMAP endpoints and their WebSocket to the target', () => {
    expect(makeJmapDevProxy('http://127.0.0.1:18300')).toEqual([
      expect.objectContaining({
        pathFilter: '/jmap/session',
        target: 'http://127.0.0.1:18300',
        selfHandleResponse: true
      }),
      expect.objectContaining({
        pathFilter: [
          '/jmap',
          '/upload',
          '/download',
          '/eventSource',
          '/.well-known/jmap'
        ],
        target: 'http://127.0.0.1:18300',
        ws: true
      })
    ])
  })
})
