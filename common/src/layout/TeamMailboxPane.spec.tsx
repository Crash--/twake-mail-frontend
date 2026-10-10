import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { TeamMailboxPane } from './TeamMailboxPane'

describe('TeamMailboxPane', () => {
  it('starts 16 px below the top of the frame, flush with its sides', () => {
    renderDs(<TeamMailboxPane data-testid="content">Body</TeamMailboxPane>)

    const content = screen.getByTestId('content')
    const pane = content.closest('main')?.parentElement
    expect(pane).toHaveClass('u-pt-1')
    expect(pane).not.toHaveClass('u-ph-1')
    expect(content).toHaveTextContent('Body')
  })
})
