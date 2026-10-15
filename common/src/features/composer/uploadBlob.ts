/** What the JMAP upload endpoint answers (RFC 8620, 6.1) */
export interface UploadedBlob {
  blobId: string
  type: string
  size: number
}

export interface UploadAuth {
  /** `Authorization` header value, null when signed out */
  getAuthorizationHeader: () => Promise<string | null>
  /** Renews the credentials after a 401; false when it could not */
  onUnauthorized: () => Promise<boolean>
}

export interface UploadOptions {
  /** The upload URL of the session, `{accountId}` already replaced */
  url: string
  blob: Blob
  type: string
  auth: UploadAuth
  /** Bytes sent so far, out of the total */
  onProgress?: (loaded: number, total: number) => void
  signal?: AbortSignal
  /**
   * Fails the upload when its progress has not moved, or when the server
   * has not answered once the body is sent, for this long (milliseconds)
   */
  stallTimeout?: number
}

/** A stalled upload fails after this long, so it can be retried */
export const UPLOAD_STALL_TIMEOUT = 60_000

export class UploadError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Upload failed with status ${status}`)
    this.name = 'UploadError'
    this.status = status
  }
}

function isUploadedBlob(value: unknown): value is UploadedBlob {
  return (
    typeof value === 'object' &&
    value !== null &&
    'blobId' in value &&
    typeof value.blobId === 'string' &&
    'size' in value &&
    typeof value.size === 'number'
  )
}

function abortError(): DOMException {
  return new DOMException('The upload was cancelled', 'AbortError')
}

function send(
  {
    url,
    blob,
    type,
    onProgress,
    signal,
    stallTimeout = UPLOAD_STALL_TIMEOUT
  }: UploadOptions,
  authorization: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const request = new XMLHttpRequest()
    let watchdog: ReturnType<typeof setTimeout> | null = null
    const settle = (): void => {
      if (watchdog !== null) clearTimeout(watchdog)
      signal?.removeEventListener('abort', handleAbort)
    }
    const handleAbort = (): void => {
      request.abort()
    }
    // Rejected before the abort, so the upload fails instead of being
    // taken for a cancellation
    const handleStall = (): void => {
      settle()
      reject(new UploadError(0))
      request.abort()
    }
    const rearm = (): void => {
      if (watchdog !== null) clearTimeout(watchdog)
      watchdog = setTimeout(handleStall, stallTimeout)
    }
    request.open('POST', url)
    request.setRequestHeader('Authorization', authorization)
    request.setRequestHeader('Content-Type', type)
    request.upload.onprogress = event => {
      rearm()
      onProgress?.(
        event.loaded,
        event.lengthComputable ? event.total : blob.size
      )
    }
    // The body is sent: the server now has as long to answer
    request.upload.onload = rearm
    request.onload = () => {
      settle()
      resolve({ status: request.status, body: request.responseText })
    }
    request.onerror = () => {
      settle()
      reject(new UploadError(0))
    }
    request.onabort = () => {
      settle()
      reject(abortError())
    }
    signal?.addEventListener('abort', handleAbort)
    rearm()
    request.send(blob)
  })
}

/**
 * Uploads a blob to the JMAP upload endpoint with progress events and
 * cancellation, which `fetch` cannot report (jmap-client-ts' `upload` is
 * fetch based). Renews the credentials once on a 401, as the client does.
 * Rejects with an `AbortError` `DOMException` when cancelled, and with an
 * `UploadError` when it stalls (see `stallTimeout`).
 */
export async function uploadBlob(
  options: UploadOptions
): Promise<UploadedBlob> {
  const { auth } = options
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const authorization = await auth.getAuthorizationHeader()
    if (authorization === null) throw new UploadError(401)
    const { status, body } = await send(options, authorization)
    if (status === 401 && attempt === 0 && (await auth.onUnauthorized())) {
      continue
    }
    if (status < 200 || status >= 300) throw new UploadError(status)
    const parsed: unknown = JSON.parse(body)
    if (!isUploadedBlob(parsed)) throw new UploadError(status)
    return {
      blobId: parsed.blobId,
      size: parsed.size,
      type:
        'type' in parsed && typeof parsed.type === 'string'
          ? parsed.type
          : options.type
    }
  }
  throw new UploadError(401)
}

/** The upload URL of a session for an account */
export function uploadUrlFor(template: string, accountId: string): string {
  return template.replace('{accountId}', encodeURIComponent(accountId))
}
