import type { IncomingMessage, ServerResponse } from 'node:http'

import type { ProxyConfig, ProxyOptions } from '@rsbuild/core'

/**
 * Development proxy to a JMAP server (`JMAP_PROXY_TARGET`), so that the app
 * and JMAP share the origin of the development server: no CORS, and the
 * WebSocket goes through the same host.
 *
 * The JMAP session lists absolute URLs (API, upload, download, WebSocket,
 * ticket endpoint) built from the server's own public origin: the proxy
 * rewrites them to the origin of the development server.
 */

/** Paths served by the JMAP server (tmail-backend) */
export const JMAP_PROXY_PATHS: readonly string[] = [
  '/jmap',
  '/upload',
  '/download',
  '/eventSource',
  '/.well-known/jmap'
]

const SESSION_PATH = '/jmap/session'
const ORIGIN_PATTERN = /^(?:https?|wss?):\/\/[^/?#]+/i
const WEBSOCKET_CAPABILITY = 'urn:ietf:params:jmap:websocket'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toHttpOrigin(origin: string): string {
  return origin.replace(/^ws/i, 'http').toLowerCase()
}

function toWebSocketOrigin(origin: string): string {
  return origin.replace(/^http/i, 'ws')
}

function readOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = ORIGIN_PATTERN.exec(value)
  return match ? toHttpOrigin(match[0]) : null
}

/** The origins the session advertises its endpoints on, as http(s) */
export function findAdvertisedOrigins(session: unknown): Set<string> {
  if (!isRecord(session)) return new Set()
  const capabilities = isRecord(session.capabilities)
    ? session.capabilities
    : {}
  const webSocket = capabilities[WEBSOCKET_CAPABILITY]
  const candidates = [
    session.apiUrl,
    session.uploadUrl,
    session.downloadUrl,
    session.eventSourceUrl,
    isRecord(webSocket) ? webSocket.url : null
  ]
  return new Set(candidates.map(readOrigin).filter(origin => origin !== null))
}

/**
 * Replaces, in every string of `value`, the advertised origins by
 * `devOrigin` (`ws:` URLs get the WebSocket form of `devOrigin`).
 */
export function rewriteOrigins(
  value: unknown,
  advertised: ReadonlySet<string>,
  devOrigin: string
): unknown {
  if (typeof value === 'string') {
    const match = ORIGIN_PATTERN.exec(value)
    if (!match || !advertised.has(toHttpOrigin(match[0]))) return value
    const isWebSocket = /^wss?:/i.test(match[0])
    const origin = isWebSocket ? toWebSocketOrigin(devOrigin) : devOrigin
    return `${origin}${value.slice(match[0].length)}`
  }
  if (Array.isArray(value)) {
    return value.map(item => rewriteOrigins(item, advertised, devOrigin))
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rewriteOrigins(item, advertised, devOrigin)
      ])
    )
  }
  return value
}

/** The JMAP session with its URLs moved to the development server */
export function rewriteSession(body: string, devOrigin: string): string {
  const session: unknown = JSON.parse(body)
  return JSON.stringify(
    rewriteOrigins(session, findAdvertisedOrigins(session), devOrigin)
  )
}

function readBody(stream: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    stream.on('error', reject)
  })
}

function devOriginOf(request: IncomingMessage): string {
  return `http://${request.headers.host ?? 'localhost'}`
}

async function forwardSession(
  proxyResponse: IncomingMessage,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const body = await readBody(proxyResponse)
  const status = proxyResponse.statusCode ?? 502
  let rewritten = body
  if (status === 200) {
    try {
      rewritten = rewriteSession(body, devOriginOf(request))
    } catch (error: unknown) {
      console.warn('[jmap proxy] Cannot rewrite the JMAP session', error)
    }
  }
  const headers = { ...proxyResponse.headers }
  delete headers['content-length']
  delete headers['transfer-encoding']
  response.writeHead(status, headers)
  response.end(rewritten)
}

/**
 * `server.proxy` of Rsbuild for a JMAP server, or `undefined` when no
 * target is configured.
 */
export function makeJmapDevProxy(
  target: string | undefined
): ProxyConfig | undefined {
  if (!target) return undefined

  const session: ProxyOptions = {
    pathFilter: SESSION_PATH,
    target,
    changeOrigin: true,
    selfHandleResponse: true,
    // The body is rewritten: ask for it uncompressed
    headers: { 'accept-encoding': 'identity' },
    on: {
      proxyRes: (proxyResponse, request, response) => {
        forwardSession(proxyResponse, request, response).catch(
          (error: unknown) => {
            console.error('[jmap proxy] Session request failed', error)
            response.writeHead(502)
            response.end()
          }
        )
      }
    }
  }
  const others: ProxyOptions = {
    pathFilter: [...JMAP_PROXY_PATHS],
    target,
    changeOrigin: true,
    autoRewrite: true,
    ws: true
  }
  return [session, others]
}
