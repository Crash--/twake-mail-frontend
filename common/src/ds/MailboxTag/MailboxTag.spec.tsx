import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { MailboxTag } from './MailboxTag'

describe('MailboxTag', () => {
  it('shows the name of the folder and says where the email is', () => {
    renderDs(<MailboxTag name="Inbox" label="In Inbox" data-testid="tag" />)

    expect(screen.getByTestId('tag')).toHaveTextContent('InboxIn Inbox')
    expect(screen.getByText('Inbox')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('In Inbox')).toHaveClass('u-visuallyhidden')
  })
})
