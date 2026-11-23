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

  it('draws the sender and preview of a collapsed message Regular, Semi Bold when strong', () => {
    renderDs(
      <>
        <MessageText variant="compactName">Read</MessageText>
        <MessageText variant="compactName" isStrong>
          Unread
        </MessageText>
        <MessageText variant="compact">Read preview</MessageText>
        <MessageText variant="compact" isStrong>
          Unread preview
        </MessageText>
      </>
    )

    expect(screen.getByText('Read')).toHaveStyle({
      fontSize: '16px',
      fontWeight: 400
    })
    expect(screen.getByText('Unread')).toHaveStyle({
      fontSize: '16px',
      fontWeight: 600
    })
    expect(screen.getByText('Read preview')).toHaveStyle({
      fontSize: '14px',
      fontWeight: 400
    })
    expect(screen.getByText('Unread preview')).toHaveStyle({
      fontSize: '14px',
      fontWeight: 600
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
