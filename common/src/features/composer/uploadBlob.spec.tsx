import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  installFakeUploads,
  type FakeUploads
} from '@common/testing/fakeUploads'

import { uploadBlob, UploadError, uploadUrlFor } from './uploadBlob'

const URL_TEMPLATE = 'https://jmap.example.com/upload/{accountId}'

function makeAuth(renewed = true): {
  getAuthorizationHeader: jest.Mock<Promise<string | null>, []>
  onUnauthorized: jest.Mock<Promise<boolean>, []>
} {
  return {
    getAuthorizationHeader: jest.fn(() => Promise.resolve('Bearer token')),
    onUnauthorized: jest.fn(() => Promise.resolve(renewed))
  }
}

async function nextHeld(uploads: FakeUploads, count: number): Promise<void> {
  while (uploads.held.length < count) {
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

describe('uploadBlob', () => {
  let uploads: FakeUploads

  beforeEach(() => {
    uploads = installFakeUploads(makeFakeJmapServer())
  })

  afterEach(() => {
    uploads.restore()
  })

  it('uploads to the account URL and reports the progress', async () => {
    const onProgress = jest.fn()
    const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' })

    const uploaded = await uploadBlob({
      url: uploadUrlFor(URL_TEMPLATE, 'account 1'),
      blob: file,
      type: 'text/plain',
      auth: makeAuth(),
      onProgress
    })

    expect(uploaded).toEqual({
      blobId: 'uploaded-1',
      type: 'text/plain',
      size: 11
    })
    expect(uploads.received).toEqual([
      {
        url: 'https://jmap.example.com/upload/account%201',
        type: 'text/plain',
        size: 11
      }
    ])
    expect(onProgress).toHaveBeenCalledWith(5, 11)
  })

  it('renews the credentials once after a 401', async () => {
    uploads.hold()
    const auth = makeAuth()
    const done = uploadBlob({
      url: URL_TEMPLATE,
      blob: new Blob(['x']),
      type: 'application/octet-stream',
      auth
    })

    await nextHeld(uploads, 1)
    uploads.held[0]?.fail(401)
    await nextHeld(uploads, 2)
    uploads.held[1]?.finish()

    await expect(done).resolves.toMatchObject({ blobId: 'uploaded-1' })
    expect(auth.onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('fails on a server error', async () => {
    uploads.hold()
    const done = uploadBlob({
      url: URL_TEMPLATE,
      blob: new Blob(['x']),
      type: 'application/octet-stream',
      auth: makeAuth()
    })

    await nextHeld(uploads, 1)
    uploads.held[0]?.fail(413)

    await expect(done).rejects.toEqual(new UploadError(413))
  })

  it('stops when cancelled', async () => {
    uploads.hold()
    const controller = new AbortController()
    const done = uploadBlob({
      url: URL_TEMPLATE,
      blob: new Blob(['x']),
      type: 'application/octet-stream',
      auth: makeAuth(),
      signal: controller.signal
    })

    await nextHeld(uploads, 1)
    controller.abort()

    await expect(done).rejects.toMatchObject({ name: 'AbortError' })
    expect(uploads.held[0]?.isAborted()).toBe(true)
  })
})
