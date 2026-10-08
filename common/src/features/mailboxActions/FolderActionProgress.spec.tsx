import { act, renderHook } from '@testing-library/react'

import {
  FolderActionProgressProvider,
  useFolderActionProgress
} from './FolderActionProgress'

const MARK_WORK = {
  kind: 'markAsRead',
  mailboxId: 'work',
  folderName: 'Work',
  total: null
} as const

describe('FolderActionProgressProvider', () => {
  it('runs one long folder action at a time, as tmail-flutter', () => {
    const { result } = renderHook(() => useFolderActionProgress(), {
      wrapper: FolderActionProgressProvider
    })

    let isStarted = false
    act(() => {
      isStarted = result.current.start(MARK_WORK)
    })
    expect(isStarted).toBe(true)
    act(() => {
      isStarted = result.current.start({ ...MARK_WORK, mailboxId: 'other' })
    })
    expect(isStarted).toBe(false)
    expect(result.current.progress?.mailboxId).toBe('work')

    act(() => {
      result.current.update(3, 10)
    })
    expect(result.current.progress).toMatchObject({ done: 3, total: 10 })

    act(() => {
      result.current.finish()
    })
    expect(result.current.progress).toBe(null)
    act(() => {
      isStarted = result.current.start(MARK_WORK)
    })
    expect(isStarted).toBe(true)
  })
})
