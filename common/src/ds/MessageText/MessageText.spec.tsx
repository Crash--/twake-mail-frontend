import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { MessageText } from './MessageText'

describe('MessageText', () => {
  it('draws the sender as the theme h5 and the date as its body2', () => {
    renderDs(
      <>
        <MessageText variant="name">Bob</MessageText>
        <MessageText variant="meta">28 Jul</MessageText>
      </>
    )

    expect(screen.getByText('Bob')).toHaveStyle({
      fontSize: '16px',
      fontWeight: 600
    })
    expect(screen.getByText('28 Jul')).toHaveStyle({
      fontSize: '14px',
      fontWeight: 500
    })
  })

  it('draws "To:" and the recipients as body2', () => {
    renderDs(
      <>
        <MessageText variant="label">To:</MessageText>
        <MessageText variant="recipient">Gustav</MessageText>
      </>
    )

    expect(screen.getByText('To:')).toHaveStyle({ fontSize: '14px' })
    expect(screen.getByText('Gustav')).toHaveStyle({ fontSize: '14px' })
  })
})
