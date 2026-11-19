import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ColorTag, tagTextColor } from './ColorTag'

describe('ColorTag', () => {
  it('writes in white, unless the background is too light for it', () => {
    expect(tagTextColor('#273891')).toBe('#FFFFFF')
    // Saturated and fairly light: still white
    expect(tagTextColor('#1EBBCC')).toBe('#FFFFFF')
    // Pastel: a dark shade of its hue
    expect(tagTextColor('#91CEF6')).toBe('#083C5E')
    expect(tagTextColor('#EDC661')).toBe('#5C450A')
    // Grey, or a near-white tint: a dark neutral
    expect(tagTextColor('#D9D9D9')).toBe('#424244')
    expect(tagTextColor('#F3F6F9')).toBe('#424244')
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

  it('keeps the tooltip of a cut name while the pointer is over it', async () => {
    const user = userEvent.setup()
    renderDs(
      <ColorTag
        label="A very long label name"
        color="#273891"
        maxLength={10}
        hasTooltip
      />
    )

    await user.hover(screen.getByText('A very lo...'))
    const tooltip = await screen.findByRole('tooltip')
    await user.hover(tooltip)

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'A very long label name'
    )
    expect(getComputedStyle(tooltip).pointerEvents).not.toBe('none')
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
