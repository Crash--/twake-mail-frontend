import { isSingletonUpdated } from './isSingletonUpdated'

describe('isSingletonUpdated', () => {
  it('is true when the singleton was updated', () => {
    expect(isSingletonUpdated({ updated: { singleton: null } })).toBe(true)
  })

  it('is false when updated is null', () => {
    expect(isSingletonUpdated({ updated: null })).toBe(false)
  })

  it('is false when the server leaves updated out', () => {
    const refused = JSON.parse(
      '{"notUpdated":{"singleton":{"type":"invalidPatch"}}}'
    ) as { updated: Record<string, unknown> | null }

    expect(isSingletonUpdated(refused)).toBe(false)
  })
})
