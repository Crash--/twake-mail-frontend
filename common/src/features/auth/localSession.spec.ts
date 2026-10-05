import {
  listComposers,
  putComposer,
  resumeComposerStorage
} from '@common/features/composer/composerStorage'

import { endLocalSession } from './localSession'

describe('endLocalSession', () => {
  it('forgets the composers kept in the browser', async () => {
    resumeComposerStorage()
    await putComposer({
      accountId: 'a',
      composerId: 'one',
      entry: { id: 'one' },
      snapshot: null
    })
    const clearLocalSession = jest.fn()

    endLocalSession({ clearLocalSession })

    expect(clearLocalSession).toHaveBeenCalledTimes(1)
    expect(await listComposers('a')).toEqual([])
  })
})
