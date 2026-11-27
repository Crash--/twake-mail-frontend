import {
  readLookedUpFiles,
  readMovedFiles,
  readSavedFile,
  settleWithin
} from './saveToDrive'

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

describe('readLookedUpFiles', () => {
  it('keeps the files out of the trash', () => {
    expect(
      readLookedUpFiles({
        files: {
          'a:e:b1': {
            fileId: 'file-1',
            name: 'r.pdf',
            dirId: 'd',
            trashed: false
          },
          'a:e:b2': {
            fileId: 'file-2',
            name: 'p.png',
            dirId: 't',
            trashed: true
          },
          'a:e:b3': null
        }
      })
    ).toEqual(new Map([['a:e:b1', 'file-1']]))
  })

  it.each([
    ['no result', null],
    ['no files', {}],
    ['a file without id', { files: { 'a:e:b1': { name: 'r.pdf' } } }]
  ])('has no file with %s', (_case, result) => {
    expect(readLookedUpFiles(result)).toEqual(new Map())
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
