import { Plus } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import { NavSectionAction } from './NavSectionAction'

describe('NavSectionAction', () => {
  it('is a button named by its label, which calls onClick', async () => {
    const onClick = jest.fn()
    renderDs(
      <NavSectionAction label="New folder" icon={Plus} onClick={onClick} />
    )

    await userEvent.click(screen.getByRole('button', { name: 'New folder' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('draws a 10 px glyph unless told otherwise', () => {
    renderDs(
      <>
        <NavSectionAction label="Add" icon={Plus} onClick={jest.fn()} />
        <NavSectionAction
          label="Refresh"
          icon={Plus}
          iconSize={20}
          onClick={jest.fn()}
        />
      </>
    )

    const glyphOf = (name: string): Element | null =>
      screen.getByRole('button', { name }).querySelector('svg')
    expect(glyphOf('Add')).toHaveAttribute('width', '10')
    expect(glyphOf('Refresh')).toHaveAttribute('width', '20')
  })

  it('keeps a 16 px glyph on a touch screen', () => {
    mockViewport({ width: 820, touch: true })
    renderDs(<NavSectionAction label="Add" icon={Plus} onClick={jest.fn()} />)

    expect(
      screen.getByRole('button', { name: 'Add' }).querySelector('svg')
    ).toHaveAttribute('width', '16')
    resetViewport()
  })

  it('passes its state to assistive technology and can be disabled', () => {
    renderDs(
      <NavSectionAction
        label="Show hidden folders"
        icon={Plus}
        aria-pressed
        aria-controls="panel"
        disabled
        onClick={jest.fn()}
      />
    )

    const button = screen.getByRole('button', { name: 'Show hidden folders' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('aria-controls', 'panel')
    expect(button).toBeDisabled()
  })
})
