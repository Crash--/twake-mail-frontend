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

    expect(screen.getByText('A very lo...')).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove the label' })
    )
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('cuts its name rather than its × when the room runs out', () => {
    renderDs(
      <ColorTag
        label="Infrastructure maintenance notices"
        color="#273891"
        removeLabel="Remove the label"
        onRemove={jest.fn()}
      />
    )

    expect(screen.getByText('Infrastructure maintenance notices')).toHaveStyle({
      minWidth: '0',
      textOverflow: 'ellipsis'
    })
    expect(
      screen.getByRole('button', { name: 'Remove the label' })
    ).toHaveStyle({ flexShrink: '0' })
  })
})
