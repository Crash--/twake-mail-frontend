import { readMovedFiles, readSavedFile, settleWithin } from './saveToDrive'

const DOCUMENT = {
  _id: 'file-1',
  _type: 'io.cozy.files',
  name: 'report.pdf',
  dir_id: 'dir-mail',
  size: '1044'
}

describe('readSavedFile', () => {
  it('reads the file Drive stored with the expected size', () => {
    expect(readSavedFile(DOCUMENT, 1044)).toEqual({
      id: 'file-1',
      name: 'report.pdf',
      dirId: 'dir-mail'
    })
    expect(readSavedFile({ ...DOCUMENT, size: 1044 }, 1044)).not.toBe(null)
  })

  it.each([
    ['an empty file (a stack without SourceURL)', { ...DOCUMENT, size: '0' }],
    [
      'another size (an HTML page instead of the file)',
      { ...DOCUMENT, size: '5177' }
    ],
    ['no id', { ...DOCUMENT, _id: undefined }],
    ['no folder', { ...DOCUMENT, dir_id: '' }],
    ['no document', null]
  ])('is no saved file with %s', (_case, document) => {
    expect(readSavedFile(document, 1044)).toBe(null)
  })
})

describe('readMovedFiles', () => {
  it('reads the moved files with their new path, and drops the others', () => {
    expect(
      readMovedFiles([
        { _id: 'file-2', name: 'report.pdf', path: '/Invoices/report.pdf' },
        { _id: 'file-3', name: 'no-path.pdf' },
        'not a document'
      ])
    ).toEqual([
      { id: 'file-2', name: 'report.pdf', path: '/Invoices/report.pdf' }
    ])
    expect(readMovedFiles(null)).toEqual([])
  })
})

describe('settleWithin', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('gives what the promise gives in time', async () => {
    await expect(
      settleWithin(Promise.resolve('token'), new AbortController().signal, 1000)
    ).resolves.toBe('token')
  })

  it('gives null once the delay is over, for a request that hangs', async () => {
    jest.useFakeTimers()
    const settled = settleWithin(
      new Promise(() => undefined),
      new AbortController().signal,
      1000
    )

    jest.advanceTimersByTime(1000)

    await expect(settled).resolves.toBe(null)
  })

  it('gives null as soon as the caller aborts', async () => {
    const controller = new AbortController()
    const settled = settleWithin(
      new Promise(() => undefined),
      controller.signal,
      60_000
    )

    controller.abort()

    await expect(settled).resolves.toBe(null)
  })

  it('gives null at once when the caller has already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      settleWithin(new Promise(() => undefined), controller.signal, 60_000)
    ).resolves.toBe(null)
  })
})
