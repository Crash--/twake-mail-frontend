import 'fake-indexeddb/auto'

import {
  clearComposerStorage,
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

describe('composerStorage', () => {
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
})
