import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Plus } from '@/ds/FlutterIcons/FlutterIcons'
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
