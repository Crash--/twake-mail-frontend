import { screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Route } from 'react-router'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import type { FeedbackWidgetProps } from '@common/features/sentry/FeedbackWidget'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AppLayout } from './AppLayout'

// The widget needs a running Sentry: its own spec covers the offset, this one
// what the layout tells it
jest.mock('@common/features/sentry/FeedbackWidget', () => ({
  FeedbackWidget: ({ hasBottomAction }: FeedbackWidgetProps): ReactElement => (
    <p data-testid="feedback-widget">{hasBottomAction ? 'raised' : 'corner'}</p>
  )
}))

function renderLayoutAt(route: string): void {
  renderWithProviders(<AppLayout />, {
    route,
    path: '*',
    withJmapSession: true,
    childRoutes: (
      <>
        <Route path="mailbox/:mailboxId" element={<p>Folder content</p>} />
        <Route
          path="mailbox/:mailboxId/email/:emailId"
          element={<p>Email content</p>}
        />
      </>
    )
  })
}

describe('AppLayout and the feedback button', () => {
  afterEach(resetViewport)

  it('keeps the feedback button above the reply bar of an email on a phone', async () => {
    mockViewport({ width: 390, touch: true })
    renderLayoutAt('/mailbox/mailbox-inbox/email/email-1')

    expect(await screen.findByTestId('feedback-widget')).toHaveTextContent(
      'raised'
    )
  })

  it('keeps the feedback button above the reply bar of an email on a tablet', async () => {
    mockViewport({ width: 820, touch: true })
    renderLayoutAt('/mailbox/mailbox-inbox/email/email-1')

    expect(await screen.findByTestId('feedback-widget')).toHaveTextContent(
      'raised'
    )
  })

  it('keeps the feedback button above "New message" in the list of a phone', async () => {
    mockViewport({ width: 390, touch: true })
    renderLayoutAt('/mailbox/mailbox-inbox')

    expect(await screen.findByTestId('feedback-widget')).toHaveTextContent(
      'raised'
    )
  })

  it('leaves the feedback button in the corner of the list on a desktop', async () => {
    mockViewport({ width: 1440 })
    renderLayoutAt('/mailbox/mailbox-inbox')

    expect(await screen.findByTestId('feedback-widget')).toHaveTextContent(
      'corner'
    )
  })
})
