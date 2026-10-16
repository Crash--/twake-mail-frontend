import {
  JmapMethodError,
  type AnyCallHandle,
  type JmapClient,
  type RequestBuilder,
  type RequestOptions,
  type Session
} from 'jmap-client-ts'

/**
 * Ids per `/get` when the session does not tell, as tmail-flutter
 * (`CapabilityIdentifierExtension.defaultMaxObjectsInGet`)
 */
export const DEFAULT_MAX_OBJECTS_IN_GET = 50

/**
 * `maxObjectsInGet` of the session: the most ids one `/get` accepts, or
 * `fallback` when the session does not tell
 */
export function maxObjectsInGet(
  session: Session,
  fallback = DEFAULT_MAX_OBJECTS_IN_GET
): number {
  const core: unknown = session.capabilities['urn:ietf:params:jmap:core']
  const value: unknown =
    typeof core === 'object' && core !== null
      ? Reflect.get(core, 'maxObjectsInGet')
      : undefined
  return typeof value === 'number' ? Math.max(1, value) : fallback
}

function isRequestTooLarge(error: unknown): boolean {
  return error instanceof JmapMethodError && error.type === 'requestTooLarge'
}

/** What a `/get` answers; `SearchSnippet/get` has no state */
interface GetResponse<T> {
  state?: string
  list: T[]
}

interface GetResult<T> {
  state: string
  list: T[]
}

export interface ChunkOptions extends RequestOptions {
  /** Ids per call when the session does not tell `maxObjectsInGet` */
  fallbackSize?: number
}

/**
 * The `/get` of `ids`, cut beforehand into chunks of `maxObjectsInGet`, one
 * request per chunk, all at once, as tmail-flutter
 * (`ThreadDetailApi.getEmailsByIds`). The state is the one of the first
 * chunk, so that push catches up from there.
 */
export async function getInChunks<T>(
  client: JmapClient,
  ids: readonly string[],
  get: (
    builder: RequestBuilder,
    chunk: string[]
  ) => AnyCallHandle & PromiseLike<GetResponse<T>>,
  { fallbackSize, ...options }: ChunkOptions = {}
): Promise<GetResult<T>> {
  const size = maxObjectsInGet(await client.getSession(), fallbackSize)
  // A server refusing fewer ids than it tells gets them in halves
  const getChunk = async (chunk: string[]): Promise<GetResponse<T>[]> => {
    try {
      return await client.request(builder => [get(builder, chunk)], options)
    } catch (error: unknown) {
      if (!isRequestTooLarge(error) || chunk.length < 2) throw error
      const half = Math.ceil(chunk.length / 2)
      const [first, second] = await Promise.all([
        getChunk(chunk.slice(0, half)),
        getChunk(chunk.slice(half))
      ])
      return [...first, ...second]
    }
  }
  // One chunk at least, empty ids included: the state comes from it
  const chunks: string[][] = []
  for (let start = 0; start === 0 || start < ids.length; start += size) {
    chunks.push(ids.slice(start, start + size))
  }
  const responses = (await Promise.all(chunks.map(getChunk))).flat()
  return {
    state: responses[0]?.state ?? '',
    list: responses.flatMap(({ list }) => list)
  }
}
