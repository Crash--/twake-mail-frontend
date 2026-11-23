import type {
  AnyCallHandle,
  BuilderArgs,
  CallArgs,
  CallOptions,
  JmapClient,
  JmapMethodName,
  MethodPropertyName,
  NarrowedMethodResponse,
  RequestBuilder,
  RequiredArgs
} from 'jmap-client-ts'

export interface BatchOptions {
  /** Most method calls in one request (`maxCallsInRequest`) */
  maxCalls: number
}

/** One `call` waiting for the next request */
interface QueuedCall {
  extraCapabilities: readonly string[]
  signal: AbortSignal | null
  /** Adds the call to a shared request; its handle settles the caller */
  register: (builder: RequestBuilder) => AnyCallHandle
  /** Sends the call alone, as the client does */
  sendAlone: () => void
}

/** The reads: only they go together */
const BATCHED_METHOD_SUFFIXES = [
  '/get',
  '/query',
  '/changes',
  '/queryChanges',
  '/autocomplete'
] as const

/**
 * Whether `method` only reads: a transport failure (5xx, reset, deadline)
 * of a shared request fails every call in it, and a read failing must not
 * take a write (`Email/set`, `Mailbox/clear`…) down with it. Writes are sent
 * alone, as before.
 */
export function isBatchedMethod(method: string): boolean {
  return BATCHED_METHOD_SUFFIXES.some(suffix => method.endsWith(suffix))
}

function groupKey(call: QueuedCall): string {
  return JSON.stringify(call.extraCapabilities)
}

function groupByCapabilities(
  queue: readonly QueuedCall[]
): readonly (readonly QueuedCall[])[] {
  const groups = Map.groupBy(queue, groupKey)
  return [...groups.values()]
}

function chunk<T>(
  items: readonly T[],
  size: number
): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  )
}

/**
 * A signal aborted once every call of the request was: a caller giving up
 * only drops its own result, the others still need the answer. `undefined`
 * when one call cannot be aborted.
 */
function sharedSignal(calls: readonly QueuedCall[]): AbortSignal | undefined {
  const signals = calls.map(call => call.signal)
  if (signals.some(signal => signal === null)) return undefined
  const controller = new AbortController()
  const abortWhenAll = (): void => {
    if (signals.every(signal => signal?.aborted === true)) controller.abort()
  }
  signals.forEach(signal => {
    signal?.addEventListener('abort', abortWhenAll, { once: true })
  })
  abortWhenAll()
  return controller.signal
}

/** What `fetch` rejects with when its signal aborts */
function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason
  return reason instanceof Error
    ? reason
    : new DOMException('The operation was aborted.', 'AbortError')
}

function sendTogether(client: JmapClient, calls: readonly QueuedCall[]): void {
  if (calls.length === 1) {
    calls[0]?.sendAlone()
    return
  }
  const signal = sharedSignal(calls)
  client
    .requestSettled(builder => calls.map(call => call.register(builder)), {
      extraCapabilities: calls[0]?.extraCapabilities ?? [],
      ...(signal ? { signal } : {})
    })
    // Each handle already settled its caller, with this error too
    .catch(() => undefined)
}

/**
 * The client, gathering the `call`s made in the same task into one request
 * (RFC 8620 section 3.3) instead of one request each: the queries started
 * together, at start-up, cost one round trip. The request leaves at the end
 * of the task (a microtask), so that a call made alone is not delayed: the
 * queries mounted in one render all start in the same task. Each caller gets its own
 * answer or error (an error in one call does not fail the others), but a
 * transport failure of the shared request fails all of them: only reads go
 * together, writes are sent alone. Calls go together only with the same
 * `extraCapabilities`, `maxCalls` at most.
 * A caller aborting gets an `AbortError` at once; the request is cancelled
 * only when every caller in it aborted. The other methods are the client's.
 */
export function withBatchedCalls(
  client: JmapClient,
  { maxCalls }: BatchOptions
): JmapClient {
  let queue: QueuedCall[] = []

  const flush = (): void => {
    // A caller that gave up meanwhile was already rejected
    const calls = queue.filter(call => call.signal?.aborted !== true)
    queue = []
    groupByCapabilities(calls)
      .flatMap(group => chunk(group, maxCalls))
      .forEach(request => {
        sendTogether(client, request)
      })
  }

  const enqueue = (call: QueuedCall): void => {
    if (queue.length === 0) queueMicrotask(flush)
    queue.push(call)
  }

  const callInBatch = <
    M extends JmapMethodName,
    const Property extends MethodPropertyName<M> = never
  >(
    method: M,
    args: CallArgs<M, Property>,
    options?: CallOptions
  ): Promise<NarrowedMethodResponse<M, Property>> =>
    new Promise((resolve, reject) => {
      const signal = options?.signal ?? null
      if (signal?.aborted === true) {
        reject(abortError(signal))
        return
      }
      signal?.addEventListener(
        'abort',
        () => {
          reject(abortError(signal))
        },
        { once: true }
      )
      const callOptions: CallOptions = options ?? {}
      enqueue({
        extraCapabilities: options?.extraCapabilities ?? [],
        signal,
        register: builder => {
          // The same arguments: the builder only accepts back-references
          // besides, which the compiler cannot match for a generic method
          const handle = builder.call<M, Property>(
            method,
            args as BuilderArgs<M, Property> & RequiredArgs<M, never>
          )
          handle.then(resolve, reject)
          return handle
        },
        sendAlone: () => {
          client.call(method, args, callOptions).then(resolve, reject)
        }
      })
    })

  const call = <
    M extends JmapMethodName,
    const Property extends MethodPropertyName<M> = never
  >(
    method: M,
    args: CallArgs<M, Property>,
    options?: CallOptions
  ): Promise<NarrowedMethodResponse<M, Property>> =>
    isBatchedMethod(method)
      ? callInBatch(method, args, options)
      : client.call(method, args, options)

  return {
    getSession: () => client.getSession(),
    refreshSession: () => client.refreshSession(),
    getPrimaryAccountId: capability => client.getPrimaryAccountId(capability),
    hasCapability: (capability, accountId) =>
      client.hasCapability(capability, accountId),
    onSessionChange: listener => client.onSessionChange(listener),
    call,
    request: (build, options) => client.request(build, options),
    requestSettled: (build, options) => client.requestSettled(build, options),
    upload: (accountId, data, contentType, options) =>
      client.upload(accountId, data, contentType, options),
    getDownloadUrl: params => client.getDownloadUrl(params),
    download: (params, options) => client.download(params, options),
    connectWebSocket: options => client.connectWebSocket(options)
  }
}
