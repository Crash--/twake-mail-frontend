import { fireEvent, screen } from '@testing-library/react'

import { SelectAll } from '@/ds/FlutterIcons/FlutterIcons'
import { renderDs } from '@/ds/testing/renderDs'

import { ToolbarButton } from './ToolbarButton'

describe('ToolbarButton', () => {
  it('is a button named by its label', () => {
    const onClick = jest.fn()
    renderDs(
      <ToolbarButton label="Select all" icon={SelectAll} onClick={onClick} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('announces the menu it opens', () => {
    renderDs(
      <ToolbarButton
        label="Filter"
        icon={SelectAll}
        hasMenu
        aria-haspopup="menu"
        aria-expanded={false}
        onClick={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: 'Filter' })).toHaveAttribute(
      'aria-haspopup',
      'menu'
    )
  })
})
