import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { MessageText } from './MessageText'

describe('MessageText', () => {
  it('draws the sender in Medium 15/20 black and the date in Regular 14 grey, as tmail-flutter', () => {
    renderDs(
      <>
        <MessageText variant="name">Bob</MessageText>
        <MessageText variant="meta">28 Jul</MessageText>
      </>
    )

    expect(screen.getByText('Bob')).toHaveStyle({
      fontSize: '15px',
      lineHeight: '20px',
      fontWeight: 500,
      color: '#000000'
    })
    expect(screen.getByText('28 Jul')).toHaveStyle({
      fontSize: '14px',
      fontWeight: 400,
      color: '#6D7885'
    })
  })

  it('draws "To:" in light grey and the recipients in black', () => {
    renderDs(
      <>
        <MessageText variant="label">To:</MessageText>
        <MessageText variant="recipient">Gustav</MessageText>
      </>
    )

    expect(screen.getByText('To:')).toHaveStyle({ color: '#9AA7B6' })
    expect(screen.getByText('Gustav')).toHaveStyle({ color: '#000000' })
  })
})
