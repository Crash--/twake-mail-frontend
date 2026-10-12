import { screen, within } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { ShortcutList, splitKeys } from './ShortcutList'

describe('ShortcutList', () => {
  it('splits the keys of a shortcut, keeping a plus key', () => {
    expect(splitKeys('Ctrl + Enter')).toEqual(['Ctrl', 'Enter'])
    expect(splitKeys('+')).toEqual(['+'])
    expect(splitKeys('Ctrl++')).toEqual(['Ctrl', '+'])
  })

  it('is a table of what each shortcut does and its keys, read with a plus between them', () => {
    renderDs(
      <>
        <h2 id="title">Composer</h2>
        <ShortcutList
          labelledBy="title"
          actionHeader="Action"
          keyHeader="Key"
          rows={[{ keys: 'Ctrl+Enter', label: 'Send the message' }]}
        />
      </>
    )

    const table = screen.getByRole('table', { name: 'Composer' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2)
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent(
      'Send the messageCtrl + Enter'
    )
  })
})
