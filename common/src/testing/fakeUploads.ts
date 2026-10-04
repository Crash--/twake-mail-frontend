import type { FakeJmapServer } from './fakeJmapServer'

/** An upload the test holds, to look at the screen while it runs */
export interface HeldUpload {
  name: string
  /** Reports half of the bytes sent */
  progress: () => void
  /** Ends it, the blob stored */
  finish: () => void
  /** Ends it with an HTTP error */
  fail: (status: number) => void
  isAborted: () => boolean
}

export interface FakeUploads {
  /** Uploads wait for `finish()` instead of ending at once */
  hold: () => void
  held: HeldUpload[]
  /** Uploads received, in order */
  received: { url: string; type: string; size: number }[]
  restore: () => void
}

/** jsdom's Blob has no `text()` */
function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Unreadable blob'))
    }
    reader.readAsText(blob)
  })
}

type ProgressHandler = ((event: ProgressEvent) => void) | null

/**
 * Replaces `XMLHttpRequest` (the upload of attachments, which reports its
 * progress) by a fake storing blobs in the fake JMAP server: each upload
 * gets a blob id and its content is downloadable.
 */
export function installFakeUploads(server: FakeJmapServer): FakeUploads {
  const original = globalThis.XMLHttpRequest
  let counter = 0
  let holding = false
  const fake: FakeUploads = {
    hold: () => {
      holding = true
    },
    held: [],
    received: [],
    restore: () => {
      Object.defineProperty(globalThis, 'XMLHttpRequest', {
        value: original,
        configurable: true,
        writable: true
      })
    }
  }

  class FakeXMLHttpRequest {
    status = 0
    responseText = ''
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null
    readonly upload: { onprogress: ProgressHandler } = { onprogress: null }
    #url = ''
    #type = ''
    #aborted = false
    #done = false

    open(_method: string, url: string): void {
      this.#url = url
    }

    setRequestHeader(name: string, value: string): void {
      if (name.toLowerCase() === 'content-type') this.#type = value
    }

    abort(): void {
      if (this.#done) return
      this.#aborted = true
      this.#done = true
      this.onabort?.()
    }

    send(body: Blob): void {
      fake.received.push({ url: this.#url, type: this.#type, size: body.size })
      const name = body instanceof File ? body.name : `blob-${counter + 1}`
      const progress = (): void => {
        this.upload.onprogress?.(
          new ProgressEvent('progress', {
            lengthComputable: true,
            loaded: Math.floor(body.size / 2),
            total: body.size
          })
        )
      }
      const finish = (): void => {
        if (this.#done) return
        this.#done = true
        counter += 1
        const blobId = `uploaded-${counter}`
        void readText(body).then(content => {
          server.blobs.set(blobId, content)
          this.status = 201
          this.responseText = JSON.stringify({
            accountId: 'account',
            blobId,
            type: this.#type,
            size: body.size
          })
          this.onload?.()
        })
      }
      const fail = (status: number): void => {
        if (this.#done) return
        this.#done = true
        this.status = status
        this.responseText = ''
        this.onload?.()
      }
      if (holding) {
        fake.held.push({
          name,
          progress,
          finish,
          fail,
          isAborted: () => this.#aborted
        })
        return
      }
      queueMicrotask(() => {
        progress()
        finish()
      })
    }
  }

  Object.defineProperty(globalThis, 'XMLHttpRequest', {
    value: FakeXMLHttpRequest,
    configurable: true,
    writable: true
  })
  return fake
}
