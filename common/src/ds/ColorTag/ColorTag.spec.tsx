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

  it('keeps the same height whatever its name and its ×', () => {
    renderDs(
      <>
        <ColorTag label="Work" color="#273891" size="small" data-testid="a" />
        <ColorTag
          label="🚀 Ünïcödé ждать"
          color="#273891"
          size="small"
          removeLabel="Remove the label"
          onRemove={jest.fn()}
          data-testid="b"
        />
        <ColorTag label="Work" color="#273891" data-testid="c" />
      </>
    )

    expect(screen.getByTestId('a')).toHaveStyle({ height: '16px' })
    expect(screen.getByTestId('b')).toHaveStyle({ height: '16px' })
    expect(screen.getByTestId('c')).toHaveStyle({ height: '20px' })
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
