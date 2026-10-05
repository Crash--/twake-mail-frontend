import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ColorTag, readableTextColor } from './ColorTag'

describe('ColorTag', () => {
  it('writes in black or white, whichever contrasts most', () => {
    expect(readableTextColor('#273891')).toBe('#FFFFFF')
    expect(readableTextColor('#EDC661')).toBe('#000000')
  })

  it('shortens long names and removes itself with its × button', async () => {
    const onRemove = jest.fn()
    renderDs(
      <ColorTag
        label="A very long label name"
        color="#273891"
        maxLength={10}
        removeLabel="Remove the label"
        onRemove={onRemove}
      />
    )

    expect(screen.getByText('A very lon…')).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove the label' })
    )
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
