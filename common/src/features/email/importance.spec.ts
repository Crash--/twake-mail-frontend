import {
  IMPORTANCE_HEADER,
  isMarkedImportant,
  PRIORITY_HEADER,
  X_PRIORITY_HEADER
} from './importance'

describe('isMarkedImportant', () => {
  it('reads any of the three headers, as tmail-flutter', () => {
    expect(isMarkedImportant({ [X_PRIORITY_HEADER]: '1 (Highest)' })).toBe(true)
    expect(isMarkedImportant({ [IMPORTANCE_HEADER]: ' High ' })).toBe(true)
    expect(isMarkedImportant({ [PRIORITY_HEADER]: 'URGENT' })).toBe(true)
  })

  it('is false without them, or with a normal priority', () => {
    expect(isMarkedImportant({})).toBe(false)
    expect(
      isMarkedImportant({
        [X_PRIORITY_HEADER]: '3',
        [IMPORTANCE_HEADER]: 'normal',
        [PRIORITY_HEADER]: null
      })
    ).toBe(false)
  })
})
