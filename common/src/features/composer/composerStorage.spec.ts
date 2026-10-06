import 'fake-indexeddb/auto'

import {
  buryComposer,
  clearComposerStorage,
  keepComposerBeforeUnload,
  COMPOSER_TTL_MS,
  listComposers,
  putComposer,
  removeComposer
} from './composerStorage'

function record(
  accountId: string,
  composerId: string,
  subject = 'Subject'
): Parameters<typeof putComposer>[0] {
  return {
    accountId,
    composerId,
    entry: { id: composerId },
    snapshot: { html: `<p>${subject}</p>` }
  }
}

/** `sessionStorage` for Node */
function stubSessionStorage(): Storage {
  const items = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return items.size
    },
    key: index => [...items.keys()][index] ?? null,
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
    removeItem: key => {
      items.delete(key)
    },
    clear: () => {
      items.clear()
    }
  }
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    configurable: true
  })
  return storage
}

describe('composerStorage', () => {
  beforeEach(() => {
    stubSessionStorage()
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await clearComposerStorage()
  })

  it('keeps the composers of an account, apart from the other accounts', async () => {
    await listComposers('a')
    await putComposer(record('a', 'one'))
    await putComposer(record('b', 'two'))

    expect((await listComposers('a')).map(stored => stored.composerId)).toEqual(
      ['one']
    )
    expect((await listComposers('b')).map(stored => stored.composerId)).toEqual(
      ['two']
    )
  })

  it('replaces the record of a composer written again', async () => {
    await listComposers('a')
    await putComposer(record('a', 'one', 'First'))
    await putComposer(record('a', 'one', 'Second'))

    const stored = await listComposers('a')
    expect(stored).toHaveLength(1)
    expect(stored[0]?.snapshot).toEqual({ html: '<p>Second</p>' })
  })

  it('forgets a composer that was removed, even right after a write', async () => {
    await listComposers('a')
    void putComposer(record('a', 'one'))
    await removeComposer('a', 'one')

    expect(await listComposers('a')).toEqual([])
  })

  it('drops the composers older than a day', async () => {
    await listComposers('a')
    await putComposer(record('a', 'old'))
    const now = Date.now()
    jest.spyOn(Date, 'now').mockReturnValue(now + COMPOSER_TTL_MS + 1000)

    expect(await listComposers('a')).toEqual([])
    jest.restoreAllMocks()
    expect(await listComposers('a')).toEqual([])
  })

  it('clears every account on sign out, and ignores the writes that follow', async () => {
    await listComposers('a')
    await putComposer(record('a', 'one'))
    await putComposer(record('b', 'two'))

    const cleared = clearComposerStorage()
    // A debounced write of a composer still open in this tab
    void putComposer(record('a', 'late'))
    await cleared

    expect(await listComposers('a')).toEqual([])
    expect(await listComposers('b')).toEqual([])
  })

  it('does not keep a body too big for the browser', async () => {
    await listComposers('a')
    await putComposer({
      ...record('a', 'big'),
      snapshot: { html: 'x'.repeat(2_000_001) }
    })

    expect(await listComposers('a')).toEqual([])
  })

  it('takes the synchronous copy of a page that went before its write ended', async () => {
    await listComposers('a')
    await putComposer(record('a', 'one', 'Old'))
    keepComposerBeforeUnload(record('a', 'one', 'Newer'))
    keepComposerBeforeUnload(record('a', 'two', 'Only in the copy'))

    const stored = await listComposers('a')

    expect(stored.map(item => item.snapshot)).toEqual([
      { html: '<p>Newer</p>' },
      { html: '<p>Only in the copy</p>' }
    ])
    // Taken once
    expect(await listComposers('a')).toHaveLength(2)
    expect(sessionStorage.length).toBe(0)
  })

  it('drops the synchronous copy of a composer removed or signed out', async () => {
    await listComposers('a')
    keepComposerBeforeUnload(record('a', 'one'))
    await removeComposer('a', 'one')
    keepComposerBeforeUnload(record('a', 'two'))
    await clearComposerStorage()

    expect(sessionStorage.length).toBe(0)
  })

  it('does not bring back a composer discarded just before the page went', async () => {
    await listComposers('a')
    await putComposer(record('a', 'gone', 'Discarded'))
    await putComposer(record('a', 'kept', 'Kept'))
    // The page goes right after "Discard": the IndexedDB delete never ran
    buryComposer('a', 'gone')
    keepComposerBeforeUnload(record('a', 'gone', 'Late copy'))

    const stored = await listComposers('a')

    expect(stored.map(item => item.composerId)).toEqual(['kept'])
    // Purged for good, and the mark is dropped
    expect(sessionStorage.length).toBe(0)
    expect((await listComposers('a')).map(item => item.composerId)).toEqual([
      'kept'
    ])
  })

  it('drops the marks of a signed out tab', async () => {
    await listComposers('a')
    buryComposer('a', 'one')
    await clearComposerStorage()

    expect(sessionStorage.length).toBe(0)
  })
})
