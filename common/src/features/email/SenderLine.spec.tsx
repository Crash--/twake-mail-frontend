import { screen } from '@testing-library/react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { SenderLine } from './SenderLine'

describe('SenderLine', () => {
  it('shows the name and the address of the sender', async () => {
    renderWithProviders(
      <SenderLine
        sender={{ name: 'Bob', email: 'bob@example.com' }}
        data-testid="sender"
      />,
      { withJmapSession: true }
    )

    expect(await screen.findByTestId('sender')).toHaveTextContent(
      'Bob <bob@example.com>'
    )
  })

  it('shows only the real address when the name holds another one', async () => {
    renderWithProviders(
      <SenderLine
        sender={{ name: 'ceo@bank.com', email: 'x@evil.com' }}
        data-testid="sender"
      />,
      { withJmapSession: true }
    )

    const line = await screen.findByTestId('sender')
    expect(line).toHaveTextContent('x@evil.com')
    expect(line).not.toHaveTextContent('ceo@bank.com')
    expect(line).not.toHaveTextContent('<')
  })
})
