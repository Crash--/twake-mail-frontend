import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { MessageText } from './MessageText'

describe('MessageText', () => {
  it('draws the sender name in Bold 17/24 and the date in Medium 14', () => {
    renderDs(
      <>
        <MessageText variant="name">Bob</MessageText>
        <MessageText variant="meta">28 Jul</MessageText>
      </>
    )

    expect(screen.getByText('Bob')).toHaveStyle({
      fontSize: '17px',
      lineHeight: '24px',
      fontWeight: 700
    })
    expect(screen.getByText('28 Jul')).toHaveStyle({
      fontSize: '14px',
      fontWeight: 500
    })
  })

  it('draws the compact name in Medium 15', () => {
    renderDs(<MessageText variant="compactName">Gustav</MessageText>)

    expect(screen.getByText('Gustav')).toHaveStyle({
      fontSize: '15px',
      fontWeight: 500
    })
  })
})
